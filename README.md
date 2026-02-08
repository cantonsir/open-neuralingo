# OpenNeuralingo

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?logo=flask)](https://flask.palletsprojects.com/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)](https://vite.dev/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite)](https://www.sqlite.org/)

OpenNeuralingo is a full-stack AI language learning platform built for focused skill development across listening, reading, speaking, and writing. It combines YouTube-based intensive listening, AI-guided practice, content import, and progress tracking into one cohesive learning system.

## Table of Contents

- [Why OpenNeuralingo](#why-openneuralingo)
- [Hackathon Snapshot](#hackathon-snapshot)
- [Feature Modules](#feature-modules)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Why OpenNeuralingo

- One integrated learning experience for all four core language skills
- AI-assisted workflows that generate feedback, prompts, and vocabulary support in context
- Segment-based listening practice for deep comprehension instead of passive watching
- Persistent learner data with session history, assessments, and personal content library
- Built with production-ready web technologies and modular backend architecture

## Feature Modules

| Module | What You Can Do | Outcomes |
|-------|------------------|----------|
| Listening | Analyze YouTube videos, create subtitle-aligned loops, run mini-tests, capture vocabulary | Better comprehension, faster response time, stronger retention |
| Reading | Import PDF/EPUB/YouTube/web content, run focused reading sessions, practice comprehension with AI | Improved reading speed and understanding |
| Speaking | Practice role-play and live AI conversations, use text-to-speech support for pronunciation | More confidence and fluency in real-world scenarios |
| Writing | Generate prompts, compose responses, receive AI corrections and suggestions | Better grammar, clarity, and writing consistency |
| Platform | Manage flashcards, goals, assessments, and history in one app | Long-term learning continuity and measurable progress |

### Highlights

- Subtitle-aware loop markers for intensive listening drills
- AI-generated vocabulary definitions and contextual support
- Personal content library with upload/import workflows
- Multi-language support (20+ target languages)
- Progress dashboards and assessment statistics by module

## Technology Stack

| Layer | Technology |
|------|------------|
| Frontend | React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4 |
| Backend | Python 3.10+, Flask 3.x, Flask-CORS |
| Database | SQLite |
| AI | Google Gemini API |
| Media/Content | YouTube IFrame API, youtube-transcript-api, yt-dlp |
| File Processing | PyPDF2, EbookLib, BeautifulSoup, newspaper3k |
| Optional Speech Services | Google Cloud TTS, Google Cloud Speech-to-Text, AssemblyAI |

## System Architecture

```text
Browser (React + Vite, :3000)
        |
        | /api requests
        v
Flask API Server (:3001)
        |
        +--> SQLite (local persistence)
        +--> Google Gemini API (AI generation and feedback)
        +--> YouTube transcript and media services
        +--> Optional cloud speech services
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://python.org) 3.10+
- [pip](https://pip.pypa.io/en/stable/)
- [Google Gemini API key](https://aistudio.google.com/app/apikey) (required for AI features)
- Optional: [Google Cloud TTS API key](https://console.cloud.google.com/apis/credentials)
- Optional: Google Cloud Speech-to-Text or AssemblyAI for subtitle generation

### 1) Clone the repository

```bash
git clone https://github.com/cantonsir/open-neuralingo.git
cd open-neuralingo
```

### 2) Install frontend dependencies

```bash
npm install
```

### 3) Set up backend environment

```bash
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# Windows (cmd)
.venv\Scripts\activate.bat

# macOS/Linux
source .venv/bin/activate

pip install -r backend/requirements.txt
```

### 4) Configure environment variables

```bash
# macOS/Linux or Git Bash
cp .env.example .env.local

# Windows cmd
copy .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Update `.env.local` with your API keys.

### 5) Run the application

Run backend and frontend in separate terminals.

Terminal 1 (Backend):
```bash
python backend/run.py
```

Terminal 2 (Frontend):
```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Configuration

Use [.env.example](.env.example) as the baseline reference.

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | Yes | Google Gemini API key for AI-powered features |
| `VITE_CLOUD_TTS_API_KEY` | No | Google Cloud TTS API key for high-quality voices |

### Backend (environment variables)

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_FILE` | No | SQLite file path (default: `openneuralingo.db` in project root) |
| `UPLOAD_FOLDER` | No | Upload directory (default: `uploads`) |
| `HOST` | No | Server host (default: `0.0.0.0`) |
| `PORT` | No | Server port (default: `3001`) |
| `DEBUG` | No | Debug mode (default: `true`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Path to Google Cloud service account JSON |
| `GOOGLE_SUBTITLES_BUCKET` | No | Cloud Storage bucket for long-audio transcription |
| `ASSEMBLYAI_API_KEY` | No | AssemblyAI API key for fallback transcription |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production frontend build |

## Project Structure

```text
open-neuralingo/
|- src/                         # React frontend
|  |- components/               # UI modules (listening/reading/speaking/writing/common)
|  |- hooks/                    # Custom hooks
|  |- services/                 # API and AI service wrappers
|  |- context/                  # React context providers
|  |- utils/                    # Utility helpers
|  |- App.tsx                   # Main app shell and routing state
|  `- main.tsx                  # Frontend entry point
|- backend/                     # Flask backend
|  |- app/
|  |  |- routes/                # API blueprints by domain
|  |  |- config.py              # Environment and runtime config
|  |  `- database.py            # SQLite initialization and migrations
|  |- run.py                    # Local dev server entry
|  |- wsgi.py                   # WSGI entry for production
|  `- requirements.txt
|- .env.example                 # Environment variable template
|- package.json                 # Frontend dependencies and scripts
`- README.md
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Create loop marker (snaps to subtitle boundaries) |
| `S` | Peek at subtitles |
| `K` or `P` | Play or pause video |
| `Left` | Previous sentence |
| `Right` | Next sentence |

## Troubleshooting

Port already in use:

```bash
# Backend (3001)
npx kill-port 3001

# Frontend (3000)
npx kill-port 3000
```

Reset local database:

```bash
# macOS/Linux
rm openneuralingo.db

# Windows (cmd)
del openneuralingo.db

# Windows (PowerShell)
Remove-Item openneuralingo.db
```

Python environment issues:

```bash
# Example: use explicit Python executable
C:\\Path\\To\\Python\\python.exe backend/run.py
```

## API Reference

Backend endpoint documentation is available in [backend/README.md](backend/README.md).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
