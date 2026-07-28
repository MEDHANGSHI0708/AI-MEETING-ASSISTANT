import sqlite3
import json
import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "meeting_assistant.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes SQLite database tables for users, chat sessions, and messages."""
    conn = get_db()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Chats / Meetings table (stores sidebar items & meeting insights)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            meeting_id TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            source TEXT NOT NULL,
            summary TEXT,
            action_items TEXT,
            key_decisions TEXT,
            open_questions TEXT,
            transcript TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)

    # Messages table for conversational history memory
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()


# ── USER CRUD ──────────────────────────────────────────────────────────────────

def create_user(email: str, name: str, password_hash: str) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    user_id = f"user_{uuid.uuid4().hex[:10]}"
    cursor.execute(
        "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)",
        (user_id, email, name, password_hash)
    )
    conn.commit()
    user = get_user_by_id(user_id)
    conn.close()
    return user


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, created_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


# ── CHAT SESSION CRUD ──────────────────────────────────────────────────────────

def create_chat_session(
    user_id: str,
    meeting_id: str,
    title: str,
    source: str,
    summary: str,
    action_items: List[Any],
    key_decisions: List[str],
    open_questions: List[str],
    transcript: str,
) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    chat_id = f"chat_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat()

    # Convert complex pydantic/list structures to JSON strings for SQLite
    action_items_json = json.dumps([item if isinstance(item, dict) else item.model_dump() for item in action_items])
    key_decisions_json = json.dumps(key_decisions)
    open_questions_json = json.dumps(open_questions)

    cursor.execute(
        """
        INSERT INTO chats (
            id, user_id, meeting_id, title, source, summary, 
            action_items, key_decisions, open_questions, transcript, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            chat_id, user_id, meeting_id, title, source, summary,
            action_items_json, key_decisions_json, open_questions_json, transcript, now, now
        )
    )
    conn.commit()
    conn.close()
    return get_chat_by_id(chat_id, user_id)


def get_user_chats(user_id: str) -> List[Dict[str, Any]]:
    """Fetches all previous chat sessions for a specific user to populate the frontend sidebar."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, meeting_id, title, source, summary, created_at, updated_at 
        FROM chats 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
        """,
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_chat_by_id(chat_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT * FROM chats WHERE id = ? AND user_id = ?", (chat_id, user_id))
    else:
        cursor.execute("SELECT * FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    chat_dict = dict(row)
    # Parse JSON strings back into native Python lists/dicts
    chat_dict["action_items"] = json.loads(chat_dict["action_items"]) if chat_dict.get("action_items") else []
    chat_dict["key_decisions"] = json.loads(chat_dict["key_decisions"]) if chat_dict.get("key_decisions") else []
    chat_dict["open_questions"] = json.loads(chat_dict["open_questions"]) if chat_dict.get("open_questions") else []
    return chat_dict


def delete_chat(chat_id: str, user_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chats WHERE id = ? AND user_id = ?", (chat_id, user_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


# ── CHAT MESSAGE MEMORY CRUD ───────────────────────────────────────────────────

def add_chat_message(chat_id: str, role: str, content: str) -> Dict[str, Any]:
    """Adds a human or assistant message to persistent memory and updates chat timestamp."""
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()

    cursor.execute(
        "INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (chat_id, role, content, now)
    )
    cursor.execute(
        "UPDATE chats SET updated_at = ? WHERE id = ?",
        (now, chat_id)
    )
    conn.commit()
    message_id = cursor.lastrowid
    conn.close()
    return {"id": message_id, "chat_id": chat_id, "role": role, "content": content, "created_at": now}


def get_chat_messages(chat_id: str) -> List[Dict[str, Any]]:
    """Returns chronological conversation history for a chat session."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, role, content, created_at FROM messages WHERE chat_id = ? ORDER BY id ASC",
        (chat_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
