"""
Data models for the presentation app.

Defines core data structures for slides, presentations, and edits.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class SlideLayout(Enum):
    """Predefined slide layouts."""
    TITLE = "title"
    TITLE_CONTENT = "title_content"
    TWO_COLUMN = "two_column"
    BLANK = "blank"


@dataclass
class Slide:
    """Represents a single slide in a presentation."""
    index: int
    html: str  # Raw HTML content
    layout: SlideLayout = SlideLayout.BLANK
    notes: str = ""  # Speaker notes (optional)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "index": self.index,
            "html": self.html,
            "layout": self.layout.value,
            "notes": self.notes
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Slide":
        """Create from dictionary."""
        return cls(
            index=data["index"],
            html=data["html"],
            layout=SlideLayout(data.get("layout", "blank")),
            notes=data.get("notes", "")
        )


@dataclass
class Presentation:
    """Represents a complete presentation."""
    title: str
    slides: list[Slide] = field(default_factory=list)
    theme: dict = field(default_factory=dict)  # Colors, fonts

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "title": self.title,
            "slides": [slide.to_dict() for slide in self.slides],
            "theme": self.theme
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Presentation":
        """Create from dictionary."""
        return cls(
            title=data["title"],
            slides=[Slide.from_dict(s) for s in data.get("slides", [])],
            theme=data.get("theme", {})
        )


@dataclass
class PendingEdit:
    """Represents a staged edit that hasn't been committed yet."""
    edit_id: str
    slide_index: int
    operation: str  # ADD, UPDATE, DELETE, REORDER
    params: dict
    preview: str  # Human-readable description

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "edit_id": self.edit_id,
            "slide_index": self.slide_index,
            "operation": self.operation,
            "params": self.params,
            "preview": self.preview
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PendingEdit":
        """Create from dictionary."""
        return cls(
            edit_id=data["edit_id"],
            slide_index=data["slide_index"],
            operation=data["operation"],
            params=data["params"],
            preview=data["preview"]
        )
