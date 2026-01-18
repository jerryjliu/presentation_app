"""
Presentation App Backend - FastAPI Server

This server provides endpoints for:
- Streaming agent interactions for presentation creation
- Session management for multi-turn conversations
- PPTX export via Node.js subprocess
- Context file parsing with LlamaParse
"""

import asyncio
import json
import os
import logging
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Background task for session cleanup
cleanup_task: Optional[asyncio.Task] = None


async def cleanup_old_sessions():
    """Background task to clean up sessions older than 24 hours."""
    while True:
        try:
            # Import here to avoid circular imports
            from session import session_manager

            cutoff = datetime.now() - timedelta(hours=24)
            cleaned = session_manager.cleanup_old_sessions(cutoff)
            if cleaned > 0:
                logger.info(f"Cleaned up {cleaned} old sessions")
        except Exception as e:
            logger.error(f"Error in session cleanup: {e}")

        # Run every hour
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown tasks."""
    global cleanup_task

    # Startup
    logger.info("Starting presentation app backend...")
    cleanup_task = asyncio.create_task(cleanup_old_sessions())

    yield

    # Shutdown
    logger.info("Shutting down presentation app backend...")
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


# Create FastAPI app
app = FastAPI(
    title="Presentation App API",
    description="AI-powered presentation generation API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS - use environment variable for production origins
# CORS_ORIGINS can be comma-separated list: "https://app.vercel.app,http://localhost:3000"
cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
if cors_origins_env == "*":
    cors_origins = ["*"]
    cors_credentials = False
else:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",")]
    cors_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/validate-api-key")
async def validate_api_key(api_key: str = Form(...)):
    """
    Validate a LlamaCloud API key by making a test request.
    """
    if not api_key or not api_key.strip():
        raise HTTPException(status_code=400, detail="API key is required")

    api_key = api_key.strip()

    # Validate key format (LlamaCloud keys start with "llx-")
    if not api_key.startswith("llx-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid API key format. LlamaCloud API keys start with 'llx-'"
        )

    # Test the key by making a request to LlamaCloud API
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.cloud.llamaindex.ai/api/v1/projects",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10.0,
            )

            if response.status_code == 401:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid API key. Please check your key and try again."
                )
            elif response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="API key does not have permission to access LlamaCloud."
                )
            elif response.status_code >= 400:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"LlamaCloud API error: {response.status_code}"
                )

            return {"valid": True, "message": "API key is valid"}

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Timeout while validating API key. Please try again."
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to LlamaCloud: {str(e)}"
        )


@app.post("/agent-stream")
async def agent_stream(
    instructions: str = Form(...),
    is_continuation: bool = Form(False),
    resume_session_id: Optional[str] = Form(None),
    user_session_id: Optional[str] = Form(None),
    context_files: Optional[str] = Form(None),
):
    """
    Main streaming endpoint for agent interactions.

    Streams SSE events as the agent processes the request:
    - init: Agent starting
    - status: Progress updates
    - tool_use: Tool invocations
    - assistant: Agent text responses
    - complete: Final result with session info
    - error: Error messages
    """
    from agent import run_agent_stream

    # Parse context files JSON if provided
    parsed_context_files = None
    if context_files:
        try:
            parsed_context_files = json.loads(context_files)
        except json.JSONDecodeError:
            logger.warning("Failed to parse context_files JSON")

    async def event_stream():
        try:
            async for message in run_agent_stream(
                instructions=instructions,
                is_continuation=is_continuation,
                resume_session_id=resume_session_id,
                user_session_id=user_session_id,
                context_files=parsed_context_files,
            ):
                yield f"data: {json.dumps(message, default=str)}\n\n"
        except Exception as e:
            logger.error(f"Error in agent stream: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session data including presentation state."""
    from session import session_manager

    session = session_manager.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.session_id,
        "presentation": session.presentation.to_dict() if session.presentation else None,
        "pending_edits": [e.to_dict() for e in session.pending_edits],
        "is_continuation": session.is_continuation,
    }


@app.get("/session/{session_id}/slides")
async def get_slides(session_id: str):
    """Get all slides for a session."""
    from session import session_manager

    session = session_manager.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.presentation:
        return {"slides": []}

    return {
        "slides": [slide.to_dict() for slide in session.presentation.slides]
    }


@app.patch("/session/{session_id}/slides/{slide_index}")
async def update_slide_content(
    session_id: str,
    slide_index: int,
    html: str = Form(...),
):
    """Update a single slide's HTML content."""
    from session import session_manager

    session = session_manager.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.presentation:
        raise HTTPException(status_code=400, detail="No presentation in session")

    if slide_index < 0 or slide_index >= len(session.presentation.slides):
        raise HTTPException(status_code=400, detail="Invalid slide index")

    session.presentation.slides[slide_index].html = html
    session_manager.save_session(session)

    return {"success": True, "slide_index": slide_index}


@app.get("/session/{session_id}/export")
async def export_pptx(session_id: str):
    """Export presentation as PPTX file."""
    import subprocess
    import tempfile
    from session import session_manager

    session = session_manager.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.presentation or not session.presentation.slides:
        raise HTTPException(status_code=400, detail="No slides to export")

    # Prepare input for Node.js converter
    input_data = {
        "title": session.presentation.title,
        "slides": [
            {
                "html": slide.html,
                "width": 960,
                "height": 540
            }
            for slide in session.presentation.slides
        ],
        "theme": session.presentation.theme
    }

    # Create temp files
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(input_data, f)
        input_path = f.name

    output_path = tempfile.mktemp(suffix='.pptx')

    try:
        # Run Node.js converter
        converter_dir = os.path.join(os.path.dirname(__file__), 'pptx_converter')
        result = subprocess.run(
            ['node', 'convert.js', input_path, output_path],
            cwd=converter_dir,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            logger.error(f"PPTX conversion failed: {result.stderr}")
            raise HTTPException(status_code=500, detail="PPTX conversion failed")

        # Read output file
        with open(output_path, 'rb') as f:
            pptx_bytes = f.read()

        # Generate filename
        filename = f"{session.presentation.title or 'presentation'}.pptx"
        filename = "".join(c for c in filename if c.isalnum() or c in ' -_.').strip()

        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    finally:
        # Cleanup temp files
        if os.path.exists(input_path):
            os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)


@app.get("/session/{session_id}/export/pdf")
async def export_pdf(session_id: str):
    """Export presentation as PDF file (pixel-perfect rendering)."""
    import subprocess
    import tempfile
    from session import session_manager

    session = session_manager.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.presentation or not session.presentation.slides:
        raise HTTPException(status_code=400, detail="No slides to export")

    # Prepare input for Node.js PDF converter
    input_data = {
        "title": session.presentation.title,
        "slides": [
            {
                "html": slide.html,
                "width": 960,
                "height": 540
            }
            for slide in session.presentation.slides
        ],
        "theme": session.presentation.theme
    }

    # Create temp files
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(input_data, f)
        input_path = f.name

    output_path = tempfile.mktemp(suffix='.pdf')

    try:
        # Run Node.js PDF converter
        converter_dir = os.path.join(os.path.dirname(__file__), 'pptx_converter')
        result = subprocess.run(
            ['node', 'convert-pdf.js', input_path, output_path],
            cwd=converter_dir,
            capture_output=True,
            text=True,
            timeout=60  # PDF generation can take longer
        )

        if result.returncode != 0:
            logger.error(f"PDF conversion failed: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"PDF conversion failed: {result.stderr}")

        # Read output file
        with open(output_path, 'rb') as f:
            pdf_bytes = f.read()

        # Generate filename
        filename = f"{session.presentation.title or 'presentation'}.pdf"
        filename = "".join(c for c in filename if c.isalnum() or c in ' -_.').strip()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    finally:
        # Cleanup temp files
        if os.path.exists(input_path):
            os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)


@app.post("/parse-files")
async def parse_files_endpoint(
    files: list[UploadFile] = File(...),
    user_session_id: str = Form(...),
    parse_mode: str = Form("cost_effective"),
    api_key: Optional[str] = Form(None),
):
    """
    Parse uploaded files for context using LlamaParse.

    Streams SSE events with parsing progress:
    - progress: Parsing progress updates
    - complete: Final parsed content
    - error: Error messages
    """
    from parser import parse_files_stream

    # If api_key provided, temporarily set it as env var for LlamaParse
    if api_key:
        os.environ["LLAMA_CLOUD_API_KEY"] = api_key

    async def event_stream():
        try:
            file_contents = []
            for file in files:
                content = await file.read()
                file_contents.append({
                    "filename": file.filename,
                    "content": content,
                    "content_type": file.content_type
                })

            async for event in parse_files_stream(file_contents, parse_mode):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.error(f"Error parsing files: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/parse-template")
async def parse_template_endpoint(
    file: UploadFile = File(...),
    user_session_id: str = Form(...),
    api_key: Optional[str] = Form(None),
):
    """
    Parse a presentation template file with screenshot extraction.
    Returns text content and representative screenshots for style reference.
    """
    from parser import parse_template_with_screenshots
    from session import session_manager

    # If api_key provided, temporarily set it as env var for LlamaParse
    if api_key:
        os.environ["LLAMA_CLOUD_API_KEY"] = api_key

    content = await file.read()
    result = await parse_template_with_screenshots(content, file.filename)

    # Store in session if successful
    if result.get("success"):
        session = session_manager.get_or_create_session(user_session_id)
        session.style_template = result
        session_manager.save_session(session)

    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
