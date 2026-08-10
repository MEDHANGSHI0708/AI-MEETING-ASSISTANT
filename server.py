import os
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Header, status, BackgroundTasks, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

load_dotenv(override=True)

from db.database import (
    init_db,
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_chats,
    get_chat_by_id,
    delete_chat,
    get_chat_messages,
)
from schemas.models import (
    UserRegister,
    UserLogin,
    UserOut,
    TokenResponse,
    ProcessMeetingRequest,
    ChatSidebarOut,
    ChatDetailOut,
    ChatMessageRequest,
    ChatMessageOut,
    ChatHistoryResponse,
    ProgressOut,
)
from core.chat_service import (
    process_and_create_chat,
    ask_chat_question,
    stream_chat_question,
)
from utils import progress


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    print("🚀 Initializing FastAPI Backend for AI Meeting Assistant...")
    init_db()
    # Create default demo user if none exists
    if not get_user_by_email("demo@assistant.ai"):
        create_user(email="demo@assistant.ai", name="Demo User", password_hash="demo123")
    yield
    print("👋 Shutting down FastAPI Backend.")


app = FastAPI(
    title="AI Meeting Assistant Backend API",
    description="FastAPI Backend for video transcription, insight extraction, vector search, and sidebar chat session memory.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for all origins so any future frontend (React, Next.js, Vue, HTML/JS) can seamlessly connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── AUTH DEPENDENCY ────────────────────────────────────────────────────────────

def get_current_user_id(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
) -> str:
    """Dependency to retrieve the active user_id. 
    Supports X-User-ID header or Bearer tokens, fallback to default demo user."""
    if x_user_id:
        return x_user_id
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user = get_user_by_id(token)
        if user:
            return user["id"]
    
    # Default guest fallback for convenient frontend testing without login
    demo = get_user_by_email("demo@assistant.ai")
    return demo["id"] if demo else "user_default"


# ── HEALTH CHECK ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "FastAPI Meeting Assistant Backend is running!"}


# ── AUTHENTICATION ROUTES ──────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=TokenResponse)
def register(payload: UserRegister):
    existing = get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered.")
    
    user = create_user(email=payload.email, name=payload.name, password_hash=payload.password)
    user_out = UserOut(id=user["id"], email=user["email"], name=user["name"], created_at=user.get("created_at"))
    return TokenResponse(access_token=user["id"], user=user_out)


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: UserLogin):
    user = get_user_by_email(payload.email)
    if not user or user["password_hash"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    user_out = UserOut(id=user["id"], email=user["email"], name=user["name"], created_at=user.get("created_at"))
    return TokenResponse(access_token=user["id"], user=user_out)


@app.get("/api/auth/me", response_model=UserOut)
def get_me(user_id: str = Depends(get_current_user_id)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=444, detail="User not found.")
    return UserOut(id=user["id"], email=user["email"], name=user["name"], created_at=user.get("created_at"))


# ── MEETING PROCESSING ROUTE ───────────────────────────────────────────────────

@app.post("/api/meetings/process", response_model=ChatDetailOut)
def process_meeting(
    payload: ProcessMeetingRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Processes YouTube URL or local file, extracts insights, indexes vector store, 
    and creates a new chat session in the database for the user's sidebar."""
    try:
        chat_session = process_and_create_chat(
            user_id=user_id,
            source=payload.source,
            language=payload.language,
            job_id=payload.job_id,
        )
        return chat_session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process meeting: {str(e)}")
    finally:
        # The response itself carries the outcome, so the progress entry has no
        # reader left once this returns.
        progress.clear(payload.job_id)


@app.post("/api/meetings/upload", response_model=ChatDetailOut)
async def upload_and_process_meeting(
    file: UploadFile = File(...),
    language: str = Form("english"),
    job_id: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id)
):
    """Allows uploading audio/video files directly via multipart form-data."""
    uploads_dir = os.path.join(os.getcwd(), "downloads")
    os.makedirs(uploads_dir, exist_ok=True)
    file_path = os.path.join(uploads_dir, file.filename)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        chat_session = process_and_create_chat(
            user_id=user_id,
            source=file_path,
            language=language,
            job_id=job_id,
        )
        return chat_session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded file: {str(e)}")
    finally:
        progress.clear(job_id)


@app.get("/api/meetings/progress/{job_id}", response_model=ProgressOut)
def get_meeting_progress(job_id: str):
    """Polled while a meeting job runs. Returns 404 before the first stage is
    recorded and after the job finishes, which the client treats as 'no update'
    rather than an error."""
    state = progress.get(job_id)
    if not state:
        raise HTTPException(status_code=404, detail="No progress for this job.")
    return ProgressOut(
        stage=state["stage"],
        percent=state["percent"],
        detail=state["detail"],
    )


# ── SIDEBAR CHAT SESSIONS ROUTES ───────────────────────────────────────────────

@app.get("/api/chats", response_model=List[ChatSidebarOut])
def list_chats(user_id: str = Depends(get_current_user_id)):
    """Returns all previous chat sessions for the logged-in user to populate the frontend sidebar."""
    chats = get_user_chats(user_id)
    return chats


@app.get("/api/chats/{chat_id}", response_model=ChatDetailOut)
def get_chat_detail(chat_id: str, user_id: str = Depends(get_current_user_id)):
    """Returns details and meeting insights for a specific chat session."""
    chat = get_chat_by_id(chat_id, user_id=user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return chat


@app.delete("/api/chats/{chat_id}")
def delete_chat_session(chat_id: str, user_id: str = Depends(get_current_user_id)):
    """Deletes a chat session and its conversation history."""
    success = delete_chat(chat_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return {"status": "success", "message": f"Chat {chat_id} deleted."}


# ── CONVERSATIONAL CHAT MEMORY ROUTES ───────────────────────────────────────────

@app.get("/api/chats/{chat_id}/messages", response_model=List[ChatMessageOut])
def get_messages_history(chat_id: str, user_id: str = Depends(get_current_user_id)):
    """Returns previous message history (human & assistant messages) for a chat session."""
    chat = get_chat_by_id(chat_id, user_id=user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    messages = get_chat_messages(chat_id)
    return messages


@app.get("/api/chats/{chat_id}/history", response_model=ChatHistoryResponse)
def get_full_chat_history(chat_id: str, user_id: str = Depends(get_current_user_id)):
    """Returns chat details AND complete message history in one call."""
    chat = get_chat_by_id(chat_id, user_id=user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    messages = get_chat_messages(chat_id)
    return {"chat": chat, "messages": messages}


@app.post("/api/chats/{chat_id}/messages")
def send_message(
    chat_id: str,
    payload: ChatMessageRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Sends a new question to an existing chat session. 
    Retrieves vector search context, uses prior chat memory, stores response in DB."""
    try:
        result = ask_chat_question(chat_id=chat_id, user_id=user_id, question=payload.question)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating answer: {str(e)}")


@app.post("/api/chats/{chat_id}/messages/stream")
async def stream_message(
    chat_id: str,
    payload: ChatMessageRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Streams the AI response token-by-token using Server-Sent Events (SSE) for frontend animation."""
    return StreamingResponse(
        stream_chat_question(chat_id=chat_id, user_id=user_id, question=payload.question),
        media_type="text/event-stream"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
