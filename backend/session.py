"""
Session management for the presentation app.

Provides thread-safe session storage with SQLite persistence
and file system storage for presentation data.
"""

import json
import os
import sqlite3
import threading
import uuid
import logging
from datetime import datetime
from typing import Optional
from pathlib import Path

from models import Presentation, PendingEdit

logger = logging.getLogger(__name__)

# Session data directory - use DATA_DIR env var for persistent storage in production
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent))
SESSIONS_DIR = DATA_DIR / "sessions_data"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# SQLite database path
DB_PATH = DATA_DIR / "sessions.db"


class PresentationSession:
    """Represents a presentation editing session."""

    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.presentation: Optional[Presentation] = None
        self.pending_edits: list[PendingEdit] = []
        self.applied_edits: list[dict] = []
        self.context_files: list[dict] = []
        self.style_template: Optional[dict] = None  # {filename, text, screenshots}
        self.is_continuation: bool = False
        self.claude_session_id: Optional[str] = None
        self.created_at: datetime = datetime.now()
        self.updated_at: datetime = datetime.now()

    def reset(self):
        """Full reset - clear everything."""
        self.presentation = None
        self.pending_edits = []
        self.applied_edits = []
        self.context_files = []
        self.style_template = None
        self.is_continuation = False
        self.updated_at = datetime.now()

    def soft_reset(self):
        """Soft reset - keep presentation, clear pending edits."""
        self.pending_edits = []
        self.updated_at = datetime.now()

    def to_dict(self) -> dict:
        """Serialize session to dictionary."""
        return {
            "session_id": self.session_id,
            "presentation": self.presentation.to_dict() if self.presentation else None,
            "pending_edits": [e.to_dict() for e in self.pending_edits],
            "applied_edits": self.applied_edits,
            "context_files": self.context_files,
            "style_template": self.style_template,
            "is_continuation": self.is_continuation,
            "claude_session_id": self.claude_session_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PresentationSession":
        """Deserialize session from dictionary."""
        session = cls(session_id=data["session_id"])
        if data.get("presentation"):
            session.presentation = Presentation.from_dict(data["presentation"])
        session.pending_edits = [
            PendingEdit.from_dict(e) for e in data.get("pending_edits", [])
        ]
        session.applied_edits = data.get("applied_edits", [])
        session.context_files = data.get("context_files", [])
        session.style_template = data.get("style_template")
        session.is_continuation = data.get("is_continuation", False)
        session.claude_session_id = data.get("claude_session_id")
        session.created_at = datetime.fromisoformat(data["created_at"])
        session.updated_at = datetime.fromisoformat(data["updated_at"])
        return session


class SessionManager:
    """Thread-safe session manager with persistence."""

    def __init__(self):
        self._lock = threading.Lock()
        self._sessions: dict[str, PresentationSession] = {}
        self._init_db()

    def _init_db(self):
        """Initialize SQLite database."""
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    claude_session_id TEXT
                )
            """)
            conn.commit()

    def get_or_create_session(
        self,
        session_id: Optional[str] = None
    ) -> PresentationSession:
        """Get existing session or create new one."""
        with self._lock:
            if session_id and session_id in self._sessions:
                return self._sessions[session_id]

            if session_id:
                # Try to load from disk
                session = self._load_from_disk(session_id)
                if session:
                    self._sessions[session_id] = session
                    return session

            # Create new session
            session = PresentationSession(session_id)
            self._sessions[session.session_id] = session
            self._save_to_db(session)
            return session

    def save_session(self, session: PresentationSession):
        """Save session to disk."""
        with self._lock:
            session.updated_at = datetime.now()
            self._sessions[session.session_id] = session
            self._save_to_disk(session)
            self._save_to_db(session)

    def load_session(self, session_id: str) -> Optional[PresentationSession]:
        """Load session by ID."""
        with self._lock:
            if session_id in self._sessions:
                return self._sessions[session_id]

            session = self._load_from_disk(session_id)
            if session:
                self._sessions[session_id] = session
            return session

    def _save_to_disk(self, session: PresentationSession):
        """Save session data to JSON file."""
        session_dir = SESSIONS_DIR / session.session_id
        session_dir.mkdir(exist_ok=True)

        data_path = session_dir / "session.json"
        with open(data_path, 'w') as f:
            json.dump(session.to_dict(), f, indent=2)

    def _load_from_disk(self, session_id: str) -> Optional[PresentationSession]:
        """Load session data from JSON file."""
        data_path = SESSIONS_DIR / session_id / "session.json"
        if not data_path.exists():
            return None

        try:
            with open(data_path, 'r') as f:
                data = json.load(f)
            return PresentationSession.from_dict(data)
        except Exception as e:
            logger.error(f"Error loading session {session_id}: {e}")
            return None

    def _save_to_db(self, session: PresentationSession):
        """Save session metadata to SQLite."""
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO sessions
                (session_id, created_at, updated_at, claude_session_id)
                VALUES (?, ?, ?, ?)
            """, (
                session.session_id,
                session.created_at.isoformat(),
                session.updated_at.isoformat(),
                session.claude_session_id
            ))
            conn.commit()

    def cleanup_old_sessions(self, cutoff: datetime) -> int:
        """Remove sessions older than cutoff. Returns count of cleaned sessions."""
        cleaned = 0
        with self._lock:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.execute(
                    "SELECT session_id FROM sessions WHERE updated_at < ?",
                    (cutoff.isoformat(),)
                )
                old_sessions = [row[0] for row in cursor.fetchall()]

            for session_id in old_sessions:
                # Remove from memory
                self._sessions.pop(session_id, None)

                # Remove from disk
                session_dir = SESSIONS_DIR / session_id
                if session_dir.exists():
                    import shutil
                    shutil.rmtree(session_dir)

                # Remove from database
                with sqlite3.connect(DB_PATH) as conn:
                    conn.execute(
                        "DELETE FROM sessions WHERE session_id = ?",
                        (session_id,)
                    )
                    conn.commit()

                cleaned += 1

        return cleaned


# Global session manager instance
session_manager = SessionManager()
