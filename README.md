# Presentation App

AI-powered presentation generation app that creates slides via natural language chat.

## Features

- **Chat-based Creation**: Describe your presentation needs in natural language
- **HTML Slides**: Full flexibility with HTML-based slide content
- **PPTX Export**: Download presentations as PowerPoint files
- **Multi-turn Conversations**: Refine and edit presentations through dialogue
- **Context Files**: Upload reference documents to inform slide content

## Architecture

- **Backend**: FastAPI + Claude Agent SDK
- **Frontend**: Next.js + React + TypeScript + Tailwind CSS
- **Export**: Node.js subprocess with pptxgenjs

## Quick Start

### Backend

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies for PPTX converter
cd pptx_converter && npm install && cd ..

# Start the server
uvicorn main:app --reload
```

### Frontend

```bash
cd web

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000 in your browser.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/agent-stream` | POST | Main streaming endpoint for chat |
| `/session/{id}` | GET | Get session state |
| `/session/{id}/slides` | GET | Get all slides |
| `/session/{id}/export` | GET | Download PPTX |
| `/parse-files` | POST | Parse context files |

## Project Structure

```
presentation_app/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── agent.py             # Claude Agent integration
│   ├── session.py           # Session management
│   ├── models.py            # Data models
│   ├── parser.py            # LlamaParse integration
│   ├── pptx_converter/      # Node.js PPTX converter
│   └── sessions_data/       # Session storage
├── web/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   ├── components/      # React components
│   │   ├── lib/             # API client, utilities
│   │   └── types/           # TypeScript types
│   └── package.json
└── README.md
```

## Development

### Environment Variables

Backend:
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `LLAMA_CLOUD_API_KEY`: (Optional) LlamaParse API key for document parsing

Frontend:
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8000)
