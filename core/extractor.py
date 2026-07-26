import os
from typing import List
from pydantic import BaseModel, Field
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser


class ActionItem(BaseModel):
    task: str = Field(description="Description of the task")
    owner: str = Field(description="Person responsible, or 'Unassigned'")
    deadline: str = Field(description="Deadline date/time, or 'Not specified'")


class MeetingAnalysis(BaseModel):
    title: str = Field(description="Short professional meeting title (max 8 words)")
    summary: str = Field(description="Comprehensive executive summary in bullet points")
    action_items: List[ActionItem] = Field(default_factory=list, description="List of action items")
    key_decisions: List[str] = Field(default_factory=list, description="List of key decisions made")
    open_questions: List[str] = Field(default_factory=list, description="List of unresolved questions or topics needing follow-up")


def get_llm():
    return ChatMistralAI(
        model="mistral-small-latest",
        mistral_api_key=os.getenv("MISTRAL_API_KEY"),
        temperature=0.2,
    )




def extract_all_meeting_insights(transcript: str) -> MeetingAnalysis:
    """
    Extracts title, summary, action items, key decisions, and open questions
    in a SINGLE unified LLM API call using Pydantic structured output.
    """
    base_llm = get_llm()
    structured_llm = base_llm.with_structured_output(MeetingAnalysis).with_retry(stop_after_attempt=3)

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an expert meeting analyst. Analyze the provided meeting transcript "
            "and extract the title, executive summary, action items, key decisions, and open questions."
        ),
        ("human", "{transcript}"),
    ])
    chain = prompt | structured_llm
    return chain.invoke({"transcript": transcript})


def extract_action_items(transcript: str) -> str:
    analysis = extract_all_meeting_insights(transcript)
    if not analysis.action_items:
        return "No action items found."
    lines = []
    for i, item in enumerate(analysis.action_items, 1):
        lines.append(f"{i}. Task: {item.task} | Owner: {item.owner} | Deadline: {item.deadline}")
    return "\n".join(lines)


def extract_key_decisions(transcript: str) -> str:
    analysis = extract_all_meeting_insights(transcript)
    if not analysis.key_decisions:
        return "No key decisions found."
    return "\n".join(f"{i}. {d}" for i, d in enumerate(analysis.key_decisions, 1))


def extract_questions(transcript: str) -> str:
    analysis = extract_all_meeting_insights(transcript)
    if not analysis.open_questions:
        return "No open questions found."
    return "\n".join(f"{i}. {q}" for i, q in enumerate(analysis.open_questions, 1))



