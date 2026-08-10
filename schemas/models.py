from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any
from datetime import datetime


# ── AUTHENTICATION SCHEMAS ───────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    created_at: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── MEETING & CHAT SCHEMAS ────────────────────────────────────────────────────

class ProcessMeetingRequest(BaseModel):
    source: str = Field(..., description="YouTube URL or local file path")
    language: str = Field(default="english", description="english or hinglish")
    job_id: Optional[str] = Field(
        default=None,
        description="Client-generated id used to poll /api/meetings/progress/{job_id}",
    )


class ProgressOut(BaseModel):
    stage: str = Field(..., description="download, convert, chunk, transcribe, insights or index")
    percent: Optional[float] = Field(None, description="0-100, or null when the stage is not measurable")
    detail: str = ""


class ActionItemOut(BaseModel):
    task: str
    owner: str = "Unassigned"
    deadline: str = "Not specified"


class MeetingInsightsOut(BaseModel):
    title: str
    summary: str
    action_items: List[ActionItemOut] = []
    key_decisions: List[str] = []
    open_questions: List[str] = []


class ChatSidebarOut(BaseModel):
    id: str
    meeting_id: str
    title: str
    source: str
    summary: Optional[str] = ""
    created_at: str
    updated_at: str


class ChatDetailOut(BaseModel):
    id: str
    meeting_id: str
    title: str
    source: str
    summary: Optional[str] = ""
    action_items: List[Any] = []
    key_decisions: List[str] = []
    open_questions: List[str] = []
    transcript: Optional[str] = ""
    created_at: str
    updated_at: str


class ChatMessageRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Question about the meeting transcript")


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


class ChatHistoryResponse(BaseModel):
    chat: ChatDetailOut
    messages: List[ChatMessageOut]
