import uuid
from dotenv import load_dotenv

load_dotenv()

def run_pipeline(source: str, language: str = "english") -> dict:
    from langchain_core.messages import HumanMessage, AIMessage
    from utils.audio_processor import process_input, cleanup_chunks
    from core.transcriber import transcribe_all
    from core.extractor import extract_all_meeting_insights
    from core.rag_engine import build_rag_chain, ask_question

    meeting_id = f"meeting_{uuid.uuid4().hex[:8]}"
    print(f"\nInitializing models & starting AI Video Assistant for [{meeting_id}]...")

    chunks = process_input(source)
    try:
        transcript = transcribe_all(chunks, language)
        print(f"\nRaw transcription sample (first 300 characters):\n{transcript[:300]}...\n")

        print("Extracting insights in unified pass...")
        insights = extract_all_meeting_insights(transcript)

        print("Building RAG vector search engine with metadata isolation...")
        rag_chain = build_rag_chain(transcript, meeting_id=meeting_id)

        return {
            "meeting_id": meeting_id,
            "insights": insights,
            "transcript": transcript,
            "rag_chain": rag_chain,
        }
    finally:
        cleanup_chunks(chunks)

if __name__ == "__main__":
    source = input("Enter YouTube URL or local file path: ").strip()
    language = input("Language (english/hinglish): ").strip() or "english"
    result = run_pipeline(source, language)

    insights = result["insights"]

    print("\n" + "=" * 60)
    print(f"📌 Title: {insights.title}")
    print(f"\n📋 Summary:\n{insights.summary}")
    
    print("\n✅ Action Items:")
    if insights.action_items:
        for i, item in enumerate(insights.action_items, 1):
            print(f"  {i}. {item.task} (Owner: {item.owner}, Deadline: {item.deadline})")
    else:
        print("  No action items found.")

    print("\n🔑 Key Decisions:")
    if insights.key_decisions:
        for i, d in enumerate(insights.key_decisions, 1):
            print(f"  {i}. {d}")
    else:
        print("  No key decisions found.")

    print("\n❓ Open Questions:")
    if insights.open_questions:
        for i, q in enumerate(insights.open_questions, 1):
            print(f"  {i}. {q}")
    else:
        print("  No open questions found.")
    print("=" * 60)

    # Phase 2 — Conversational RAG Chat with Memory
    from langchain_core.messages import HumanMessage, AIMessage
    from core.rag_engine import ask_question

    print("\n💬 Chat with your meeting (type 'exit' to quit)\n")
    rag_chain = result["rag_chain"]
    chat_history = []

    while True:
        question = input("You: ").strip()
        if question.lower() in ["exit", "quit", "q"]:
            print("👋 Goodbye!")
            break
        if not question:
            continue
        
        answer = ask_question(rag_chain, question, chat_history)

        # Record conversation history
        chat_history.append(HumanMessage(content=question))
        chat_history.append(AIMessage(content=answer))


