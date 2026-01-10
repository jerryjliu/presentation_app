"""
Claude Agent SDK integration for presentation manipulation.

Defines tools for creating and editing presentations,
and provides the main agent streaming function.
"""

import uuid
import logging
from typing import Any, AsyncGenerator, Optional
from contextvars import ContextVar

from models import Presentation, Slide, SlideLayout, PendingEdit
from session import PresentationSession, session_manager

logger = logging.getLogger(__name__)

# Context variable for current session (async-safe)
_current_session: ContextVar[Optional[PresentationSession]] = ContextVar(
    'current_session',
    default=None
)


def get_current_session() -> Optional[PresentationSession]:
    """Get the current session from context."""
    return _current_session.get()


def set_current_session(session: Optional[PresentationSession]):
    """Set the current session in context."""
    _current_session.set(session)


# Try to import Claude Agent SDK
try:
    from claude_agent_sdk import (
        ClaudeSDKClient,
        ClaudeAgentOptions,
        tool,
        create_sdk_mcp_server,
        AssistantMessage,
        TextBlock,
        ToolUseBlock,
    )
    AGENT_SDK_AVAILABLE = True
except ImportError:
    AGENT_SDK_AVAILABLE = False
    logger.warning("Claude Agent SDK not available. Using fallback mode.")

    # Fallback tool decorator
    def tool(name: str, description: str, params: dict):
        def decorator(func):
            func._tool_name = name
            func._tool_description = description
            func._tool_params = params
            return func
        return decorator


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

@tool("create_presentation", "Create a new presentation", {"title": str})
async def tool_create_presentation(args: dict[str, Any]) -> dict[str, Any]:
    """Create a new presentation with the given title."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}

    title = args.get("title", "Untitled Presentation")
    session.presentation = Presentation(title=title)
    session.pending_edits = []
    session.applied_edits = []

    return {"success": True, "title": title, "slide_count": 0}


@tool("add_slide", "Add a new slide with HTML content", {
    "html": str,
    "position": int,  # Optional - defaults to end
    "layout": str  # Optional - defaults to "blank"
})
async def tool_add_slide(args: dict[str, Any]) -> dict[str, Any]:
    """Add a new slide to the presentation."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}
    if not session.presentation:
        return {"error": "No presentation created. Use create_presentation first."}

    html = args.get("html", "")
    position = args.get("position")
    layout_str = args.get("layout", "blank")

    try:
        layout = SlideLayout(layout_str)
    except ValueError:
        layout = SlideLayout.BLANK

    # Determine position
    if position is None or position >= len(session.presentation.slides):
        index = len(session.presentation.slides)
    else:
        index = max(0, position)

    # Create pending edit
    edit = PendingEdit(
        edit_id=str(uuid.uuid4()),
        slide_index=index,
        operation="ADD",
        params={"html": html, "layout": layout.value},
        preview=f"Add slide at position {index + 1}"
    )
    session.pending_edits.append(edit)

    return {"success": True, "slide_index": index, "edit_id": edit.edit_id}


@tool("update_slide", "Update an existing slide's HTML content", {
    "slide_index": int,
    "html": str
})
async def tool_update_slide(args: dict[str, Any]) -> dict[str, Any]:
    """Update the content of an existing slide."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}
    if not session.presentation:
        return {"error": "No presentation loaded"}

    slide_index = args.get("slide_index", 0)
    html = args.get("html", "")

    if slide_index < 0 or slide_index >= len(session.presentation.slides):
        return {"error": f"Invalid slide index: {slide_index}"}

    edit = PendingEdit(
        edit_id=str(uuid.uuid4()),
        slide_index=slide_index,
        operation="UPDATE",
        params={"html": html},
        preview=f"Update slide {slide_index + 1}"
    )
    session.pending_edits.append(edit)

    return {"success": True, "slide_index": slide_index, "edit_id": edit.edit_id}


@tool("delete_slide", "Delete a slide from the presentation", {"slide_index": int})
async def tool_delete_slide(args: dict[str, Any]) -> dict[str, Any]:
    """Delete a slide from the presentation."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}
    if not session.presentation:
        return {"error": "No presentation loaded"}

    slide_index = args.get("slide_index", 0)

    if slide_index < 0 or slide_index >= len(session.presentation.slides):
        return {"error": f"Invalid slide index: {slide_index}"}

    edit = PendingEdit(
        edit_id=str(uuid.uuid4()),
        slide_index=slide_index,
        operation="DELETE",
        params={},
        preview=f"Delete slide {slide_index + 1}"
    )
    session.pending_edits.append(edit)

    return {"success": True, "slide_index": slide_index, "edit_id": edit.edit_id}


@tool("reorder_slides", "Move a slide to a new position", {
    "from_index": int,
    "to_index": int
})
async def tool_reorder_slides(args: dict[str, Any]) -> dict[str, Any]:
    """Reorder slides in the presentation."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}
    if not session.presentation:
        return {"error": "No presentation loaded"}

    from_index = args.get("from_index", 0)
    to_index = args.get("to_index", 0)
    num_slides = len(session.presentation.slides)

    if from_index < 0 or from_index >= num_slides:
        return {"error": f"Invalid from_index: {from_index}"}
    if to_index < 0 or to_index >= num_slides:
        return {"error": f"Invalid to_index: {to_index}"}

    edit = PendingEdit(
        edit_id=str(uuid.uuid4()),
        slide_index=from_index,
        operation="REORDER",
        params={"to_index": to_index},
        preview=f"Move slide {from_index + 1} to position {to_index + 1}"
    )
    session.pending_edits.append(edit)

    return {"success": True, "from_index": from_index, "to_index": to_index}


@tool("list_slides", "List all slides in the presentation", {})
async def tool_list_slides(args: dict[str, Any]) -> dict[str, Any]:
    """List all slides with their index and content preview."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}
    if not session.presentation:
        return {"slides": [], "count": 0}

    slides = []
    for slide in session.presentation.slides:
        # Create a preview by stripping HTML and truncating
        preview = slide.html[:200].replace('<', ' <').replace('>', '> ')
        import re
        preview = re.sub(r'<[^>]+>', '', preview).strip()
        preview = ' '.join(preview.split())[:100]

        slides.append({
            "index": slide.index,
            "layout": slide.layout.value,
            "preview": preview,
            "has_notes": bool(slide.notes)
        })

    return {"slides": slides, "count": len(slides)}


@tool("get_slide", "Get full details of a specific slide", {"slide_index": int})
async def tool_get_slide(args: dict[str, Any]) -> dict[str, Any]:
    """Get the full HTML content and details of a slide."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}
    if not session.presentation:
        return {"error": "No presentation loaded"}

    slide_index = args.get("slide_index", 0)

    if slide_index < 0 or slide_index >= len(session.presentation.slides):
        return {"error": f"Invalid slide index: {slide_index}"}

    slide = session.presentation.slides[slide_index]
    return {
        "index": slide.index,
        "html": slide.html,
        "layout": slide.layout.value,
        "notes": slide.notes
    }


@tool("set_theme", "Set the presentation theme (colors, fonts)", {"theme": dict})
async def tool_set_theme(args: dict[str, Any]) -> dict[str, Any]:
    """Set the presentation theme."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}
    if not session.presentation:
        return {"error": "No presentation created"}

    theme = args.get("theme", {})
    session.presentation.theme = theme

    return {"success": True, "theme": theme}


@tool("get_pending_edits", "Get all pending edits that haven't been committed", {})
async def tool_get_pending_edits(args: dict[str, Any]) -> dict[str, Any]:
    """Get all pending edits."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}

    edits = [
        {
            "edit_id": e.edit_id,
            "slide_index": e.slide_index,
            "operation": e.operation,
            "preview": e.preview
        }
        for e in session.pending_edits
    ]

    return {"edits": edits, "count": len(edits)}


@tool("commit_edits", "Apply all pending edits to the presentation", {})
async def tool_commit_edits(args: dict[str, Any]) -> dict[str, Any]:
    """Apply all pending edits."""
    session = get_current_session()
    if not session:
        return {"error": "No active session"}
    if not session.presentation:
        return {"error": "No presentation created"}

    applied_count = 0

    for edit in session.pending_edits:
        try:
            if edit.operation == "ADD":
                # Add new slide
                slide = Slide(
                    index=edit.slide_index,
                    html=edit.params.get("html", ""),
                    layout=SlideLayout(edit.params.get("layout", "blank"))
                )
                # Insert at position
                if edit.slide_index >= len(session.presentation.slides):
                    session.presentation.slides.append(slide)
                else:
                    session.presentation.slides.insert(edit.slide_index, slide)
                # Re-index all slides
                for i, s in enumerate(session.presentation.slides):
                    s.index = i

            elif edit.operation == "UPDATE":
                if 0 <= edit.slide_index < len(session.presentation.slides):
                    session.presentation.slides[edit.slide_index].html = edit.params.get("html", "")

            elif edit.operation == "DELETE":
                if 0 <= edit.slide_index < len(session.presentation.slides):
                    del session.presentation.slides[edit.slide_index]
                    # Re-index
                    for i, s in enumerate(session.presentation.slides):
                        s.index = i

            elif edit.operation == "REORDER":
                to_index = edit.params.get("to_index", 0)
                if 0 <= edit.slide_index < len(session.presentation.slides):
                    slide = session.presentation.slides.pop(edit.slide_index)
                    session.presentation.slides.insert(to_index, slide)
                    # Re-index
                    for i, s in enumerate(session.presentation.slides):
                        s.index = i

            session.applied_edits.append(edit.to_dict())
            applied_count += 1

        except Exception as e:
            logger.error(f"Error applying edit {edit.edit_id}: {e}")

    # Clear pending edits
    session.pending_edits = []

    # Save session
    session_manager.save_session(session)

    return {
        "success": True,
        "applied_count": applied_count,
        "total_slides": len(session.presentation.slides)
    }


# =============================================================================
# TOOL REGISTRATION
# =============================================================================

PRESENTATION_TOOLS = [
    tool_create_presentation,
    tool_add_slide,
    tool_update_slide,
    tool_delete_slide,
    tool_reorder_slides,
    tool_list_slides,
    tool_get_slide,
    tool_set_theme,
    tool_get_pending_edits,
    tool_commit_edits,
]

# Tool name to function mapping for fallback mode
TOOL_MAP = {func._tool_name: func for func in PRESENTATION_TOOLS if hasattr(func, '_tool_name')}


# =============================================================================
# SYSTEM PROMPTS
# =============================================================================

SYSTEM_PROMPT_NEW = """You are a presentation creation assistant. Create professional slides using HTML.

WORKFLOW:
1. Use create_presentation to start a new presentation with a title
2. Use add_slide to add slides with HTML content
3. Use commit_edits to finalize and save all changes

HTML GUIDELINES:
- Use semantic HTML (h1, h2, p, ul, li)
- Use inline styles for positioning and colors
- Keep text concise - bullet points, not paragraphs
- Slide dimensions: 960x540px (16:9 aspect ratio)

EXAMPLE SLIDE HTML:
<div style="padding: 40px; font-family: Arial, sans-serif;">
  <h1 style="color: #1a73e8; margin-bottom: 20px;">Slide Title</h1>
  <ul style="font-size: 24px; line-height: 1.6;">
    <li>First key point</li>
    <li>Second key point</li>
    <li>Third key point</li>
  </ul>
</div>

DESIGN PRINCIPLES:
- One main idea per slide
- Consistent color scheme throughout
- Use contrast for readability
- Maximum 5-6 bullet points per slide
- Use visual hierarchy with font sizes

You can call add_slide multiple times in parallel for efficiency when creating multiple slides.
Always call commit_edits when done to save the presentation."""

SYSTEM_PROMPT_CONTINUATION = """You are editing an existing presentation.

CRITICAL: Only modify slides the user specifically requests.
DO NOT change slides that weren't mentioned unless explicitly asked.

WORKFLOW:
1. Use list_slides to see all current slides
2. Use get_slide to see details of specific slides
3. Use update_slide or add_slide to make changes
4. Use commit_edits to save changes

Use list_slides first to understand the current state before making any changes."""


# =============================================================================
# AGENT STREAMING
# =============================================================================

async def run_agent_stream(
    instructions: str,
    is_continuation: bool = False,
    resume_session_id: Optional[str] = None,
    user_session_id: Optional[str] = None,
    context_files: Optional[list[dict]] = None,
) -> AsyncGenerator[dict, None]:
    """
    Run the agent and stream results.

    Args:
        instructions: User instructions
        is_continuation: Whether this is continuing a previous session
        resume_session_id: Claude session ID to resume (for multi-turn)
        user_session_id: Backend session ID
        context_files: Parsed context files

    Yields:
        SSE event dictionaries
    """
    # Get or create session
    session = session_manager.get_or_create_session(user_session_id)
    session.is_continuation = is_continuation

    if context_files:
        session.context_files = context_files

    set_current_session(session)

    yield {"type": "init", "message": "Starting agent...", "session_id": session.session_id}

    try:
        if AGENT_SDK_AVAILABLE:
            async for event in _run_with_sdk(
                session, instructions, is_continuation, resume_session_id
            ):
                yield event
        else:
            async for event in _run_fallback(session, instructions):
                yield event

        # Final event with session info
        yield {
            "type": "complete",
            "session_id": session.claude_session_id,
            "user_session_id": session.session_id,
            "slide_count": len(session.presentation.slides) if session.presentation else 0
        }

    except Exception as e:
        logger.error(f"Agent error: {e}")
        yield {"type": "error", "error": str(e)}

    finally:
        set_current_session(None)


async def _run_with_sdk(
    session: PresentationSession,
    instructions: str,
    is_continuation: bool,
    resume_session_id: Optional[str],
) -> AsyncGenerator[dict, None]:
    """Run agent using Claude Agent SDK."""
    from claude_agent_sdk import (
        ClaudeSDKClient,
        ClaudeAgentOptions,
        create_sdk_mcp_server,
        AssistantMessage,
        TextBlock,
        ToolUseBlock,
    )

    # Create MCP server with tools
    pres_server = create_sdk_mcp_server(
        name="presentation",
        version="1.0.0",
        tools=PRESENTATION_TOOLS
    )

    # Select system prompt
    system_prompt = SYSTEM_PROMPT_CONTINUATION if is_continuation else SYSTEM_PROMPT_NEW

    # Add context files to prompt if available
    if session.context_files:
        context_text = "\n\n".join([
            f"=== {f['filename']} ===\n{f['text']}"
            for f in session.context_files if f.get('text')
        ])
        if context_text:
            system_prompt += f"\n\nCONTEXT FILES:\n{context_text}"

    # Configure agent
    options = ClaudeAgentOptions(
        system_prompt=system_prompt,
        mcp_servers={"presentation": pres_server},
        allowed_tools=[
            "mcp__presentation__create_presentation",
            "mcp__presentation__add_slide",
            "mcp__presentation__update_slide",
            "mcp__presentation__delete_slide",
            "mcp__presentation__reorder_slides",
            "mcp__presentation__list_slides",
            "mcp__presentation__get_slide",
            "mcp__presentation__set_theme",
            "mcp__presentation__get_pending_edits",
            "mcp__presentation__commit_edits",
        ],
        resume=resume_session_id,
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query(instructions)

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        yield {"type": "assistant", "text": block.text}
                    elif isinstance(block, ToolUseBlock):
                        yield {
                            "type": "tool_use",
                            "tool_calls": [{
                                "name": block.name,
                                "input": block.input
                            }]
                        }

        # Store Claude session ID for resumption
        session.claude_session_id = client.session_id


async def _run_fallback(
    session: PresentationSession,
    instructions: str,
) -> AsyncGenerator[dict, None]:
    """Fallback mode when SDK is not available."""
    import os
    from anthropic import Anthropic

    client = Anthropic()

    # Build tools definition for API
    tools = [
        {
            "name": func._tool_name,
            "description": func._tool_description,
            "input_schema": {
                "type": "object",
                "properties": {
                    k: {"type": "string" if v == str else "integer" if v == int else "object"}
                    for k, v in func._tool_params.items()
                },
                "required": list(func._tool_params.keys())
            }
        }
        for func in PRESENTATION_TOOLS
        if hasattr(func, '_tool_name')
    ]

    system_prompt = SYSTEM_PROMPT_CONTINUATION if session.is_continuation else SYSTEM_PROMPT_NEW

    messages = [{"role": "user", "content": instructions}]

    # Agent loop
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            tools=tools,
            messages=messages
        )

        # Process response
        assistant_content = []
        tool_calls = []

        for block in response.content:
            if block.type == "text":
                yield {"type": "assistant", "text": block.text}
                assistant_content.append(block)
            elif block.type == "tool_use":
                tool_calls.append(block)
                yield {
                    "type": "tool_use",
                    "tool_calls": [{"name": block.name, "input": block.input}]
                }

        messages.append({"role": "assistant", "content": response.content})

        # Execute tool calls
        if tool_calls:
            tool_results = []
            for tool_call in tool_calls:
                func = TOOL_MAP.get(tool_call.name)
                if func:
                    result = await func(tool_call.input)
                else:
                    result = {"error": f"Unknown tool: {tool_call.name}"}

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_call.id,
                    "content": str(result)
                })

            messages.append({"role": "user", "content": tool_results})
        else:
            # No more tool calls, we're done
            break

        if response.stop_reason == "end_turn":
            break
