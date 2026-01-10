"""
LlamaParse integration for parsing context files.

Supports parsing various document formats (PDF, DOCX, etc.)
to extract text content for presentation context.
"""

import os
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# Check if LlamaParse is available
try:
    from llama_cloud_services import LlamaParse
    LLAMAPARSE_AVAILABLE = True
except ImportError:
    LLAMAPARSE_AVAILABLE = False
    logger.warning("llama-cloud-services not installed. File parsing will be limited.")


async def parse_files_stream(
    files: list[dict],
    parse_mode: str = "cost_effective"
) -> AsyncGenerator[dict, None]:
    """
    Parse uploaded files and stream progress.

    Args:
        files: List of dicts with 'filename', 'content' (bytes), 'content_type'
        parse_mode: Parsing mode ('cost_effective' or 'premium')

    Yields:
        Progress and result events
    """
    if not files:
        yield {"type": "complete", "results": []}
        return

    results = []
    total = len(files)

    for idx, file_data in enumerate(files):
        filename = file_data["filename"]
        content = file_data["content"]
        content_type = file_data.get("content_type", "")

        yield {
            "type": "progress",
            "current": idx + 1,
            "total": total,
            "filename": filename,
            "status": "parsing"
        }

        try:
            # Try LlamaParse first if available
            if LLAMAPARSE_AVAILABLE and os.environ.get("LLAMA_CLOUD_API_KEY"):
                parsed_text = await parse_with_llama(content, filename, parse_mode)
            else:
                # Fallback to basic parsing
                parsed_text = parse_basic(content, filename, content_type)

            results.append({
                "filename": filename,
                "text": parsed_text,
                "success": True
            })

            yield {
                "type": "progress",
                "current": idx + 1,
                "total": total,
                "filename": filename,
                "status": "complete"
            }

        except Exception as e:
            logger.error(f"Error parsing {filename}: {e}")
            results.append({
                "filename": filename,
                "text": "",
                "success": False,
                "error": str(e)
            })

            yield {
                "type": "progress",
                "current": idx + 1,
                "total": total,
                "filename": filename,
                "status": "error",
                "error": str(e)
            }

    yield {"type": "complete", "results": results}


async def parse_with_llama(
    content: bytes,
    filename: str,
    parse_mode: str
) -> str:
    """Parse file using LlamaParse."""
    from llama_cloud_services import LlamaParse

    parser = LlamaParse(
        result_type="markdown",
        parsing_instruction="Extract all text content for use in presentation slides."
    )

    # Write to temp file
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as f:
        f.write(content)
        temp_path = f.name

    try:
        documents = await parser.aload_data(temp_path)
        return "\n\n".join(doc.text for doc in documents)
    finally:
        import os
        os.unlink(temp_path)


def parse_basic(content: bytes, filename: str, content_type: str) -> str:
    """Basic parsing fallback for common formats."""
    ext = filename.lower().split('.')[-1] if '.' in filename else ''

    # Plain text files
    if ext in ['txt', 'md', 'markdown'] or 'text/' in content_type:
        try:
            return content.decode('utf-8')
        except UnicodeDecodeError:
            return content.decode('latin-1')

    # For other formats, return a placeholder
    return f"[Content from {filename} - requires LlamaParse for full extraction]"
