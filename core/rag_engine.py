import os
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from core.vector_store import build_vector_store, load_vector_store, get_retriever


def get_llm():
    return ChatMistralAI(
        model="mistral-small-latest",
        mistral_api_key=os.getenv("MISTRAL_API_KEY"),
        temperature=0.3,
    ).with_retry(stop_after_attempt=3)


def format_docs(docs):
    return "\n\n".join([doc.page_content for doc in docs])


def build_rag_chain(transcript: str, meeting_id: str = "default"):
    vector_store = build_vector_store(transcript, meeting_id=meeting_id)
    retriever = get_retriever(vector_store, k=6, meeting_id=meeting_id)
    llm = get_llm()

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an expert AI meeting assistant. Answer the user's question clearly and accurately "
            "based on the relevant context retrieved from the meeting transcript below.\n\n"
            "Guidelines:\n"
            "- Rely on the context provided to construct a helpful response.\n"
            "- If the provided context really has no relevance to the question, state: "
            "'I could not find relevant information in the transcript for that question.'\n"
            "- Keep answers clear, direct, and concise.\n\n"
            "Meeting Context:\n{context}"
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ])

    rag_chain = (
        {
            "context": (lambda x: x["question"]) | retriever | RunnableLambda(format_docs),
            "chat_history": lambda x: x.get("chat_history", []),
            "question": lambda x: x["question"],
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return rag_chain


import sys

def ask_question(rag_chain, question: str, chat_history: list = None) -> str:
    if chat_history is None:
        chat_history = []

    print("\n🤖 Assistant: ", end="", flush=True)
    full_answer = ""
    for chunk in rag_chain.stream({"question": question, "chat_history": chat_history}):
        sys.stdout.write(chunk)
        sys.stdout.flush()
        full_answer += chunk
    print("\n")
    return full_answer