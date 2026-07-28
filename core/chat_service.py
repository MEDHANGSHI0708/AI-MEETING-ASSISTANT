import uuid
from typing import Dict, Any, List, AsyncGenerator
from langchain_core.messages import HumanMessage, AIMessage
from utils.audio_processor import process_input, cleanup_chunks
from core.transcriber import transcribe_all
from core.extractor import extract_all_meeting_insights
from core.rag_engine import build_rag_chain, get_rag_chain_for_meeting
from db.database import (
    create_chat_session,
    get_chat_by_id,
    get_user_chats,
    add_chat_message,
    get_chat_messages,
    delete_chat
)


def process_and_create_chat(user_id: str, source: str, language: str = "english") -> Dict[str, Any]:
    """Runs audio/video extraction, transcription, insight generation, vector store building, 
    and saves the session in SQLite database for sidebar retrieval."""
    meeting_id = f"meeting_{uuid.uuid4().hex[:8]}"
    print(f"Processing new meeting [{meeting_id}] for user [{user_id}] from source: {source}...")

    chunks = process_input(source)
    try:
        transcript = transcribe_all(chunks, language)
        insights = extract_all_meeting_insights(transcript)
        
        # Build Chroma vector store with meeting_id metadata isolation
        build_rag_chain(transcript, meeting_id=meeting_id)

        # Action items conversion to dict list
        action_items_list = [item.model_dump() for item in insights.action_items]

        # Save to SQLite DB
        chat_session = create_chat_session(
            user_id=user_id,
            meeting_id=meeting_id,
            title=insights.title,
            source=source,
            summary=insights.summary,
            action_items=action_items_list,
            key_decisions=insights.key_decisions,
            open_questions=insights.open_questions,
            transcript=transcript,
        )

        return chat_session
    finally:
        cleanup_chunks(chunks)


def _format_langchain_history(raw_messages: List[Dict[str, Any]]) -> List[Any]:
    """Converts DB messages into LangChain HumanMessage/AIMessage objects for memory context."""
    history = []
    for msg in raw_messages:
        if msg["role"] == "user":
            history.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            history.append(AIMessage(content=msg["content"]))
    return history


def ask_chat_question(chat_id: str, user_id: str, question: str) -> Dict[str, Any]:
    """Handles an interactive chat message on an existing meeting session with memory."""
    chat = get_chat_by_id(chat_id, user_id=user_id)
    if not chat:
        raise ValueError(f"Chat session '{chat_id}' not found or unauthorized.")

    raw_messages = get_chat_messages(chat_id)
    chat_history = _format_langchain_history(raw_messages)

    rag_chain = get_rag_chain_for_meeting(chat["meeting_id"])
    
    # Generate answer using RAG chain with conversational memory
    answer = rag_chain.invoke({"question": question, "chat_history": chat_history})

    # Save question and answer into persistent message memory
    user_msg = add_chat_message(chat_id, role="user", content=question)
    ai_msg = add_chat_message(chat_id, role="assistant", content=answer)

    return {
        "user_message": user_msg,
        "assistant_message": ai_msg,
        "answer": answer
    }


async def stream_chat_question(chat_id: str, user_id: str, question: str) -> AsyncGenerator[str, None]:
    """Streams token-by-token responses using Server-Sent Events (SSE) for modern UI frontend streaming."""
    chat = get_chat_by_id(chat_id, user_id=user_id)
    if not chat:
        yield "Error: Chat session not found or unauthorized."
        return

    raw_messages = get_chat_messages(chat_id)
    chat_history = _format_langchain_history(raw_messages)

    rag_chain = get_rag_chain_for_meeting(chat["meeting_id"])
    
    # Save user question first
    add_chat_message(chat_id, role="user", content=question)

    full_answer = ""
    for chunk in rag_chain.stream({"question": question, "chat_history": chat_history}):
        full_answer += chunk
        yield chunk

    # Save complete AI answer once streaming finishes
    add_chat_message(chat_id, role="assistant", content=full_answer)
