# OpenNeuralingo

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask)](https://flask.palletsprojects.com/)

OpenNeuralingo is a full-stack language learning platform with AI-powered listening, reading, speaking, and writing workflows. It combines YouTube analysis, structured practice sessions, and a personal content library to help learners build consistent habits.


## Features

### Listening
- Loop markers that snap to subtitle boundaries (Space)
- Goal videos segmented into focused study clips
- Mini-tests with reaction time tracking
- Vocabulary capture with AI-generated definitions
- Subtitle peeking for self-checks (S)

### Reading
- Import PDFs, EPUBs, YouTube transcripts, and web articles
- Focus reading mode with AI comprehension prompts
- Session tracking with progress dashboards
- Vocabulary tools for review

### Speaking
- Live conversation practice with AI
- Scenario-based role play
- Text-to-speech playback for pronunciation

### Writing
- Composition practice with AI feedback
- Grammar corrections and suggestions
- Session history and review

### Platform
- Flashcards and vocabulary manager
- Assessment profiles, results, and mastery tracking
- Library and watch history management

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4 |
| Backend | Python 3.10+, Flask 3.0 |
| Database | SQLite |
| AI | Google Gemini API |
| Video | YouTube IFrame API via react-youtube |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://python.org) 3.10+ and pip
- [Google Gemini API key](https://aistudio.google.com/app/apikey) (required for AI features)
- Optional: [Google Cloud Text-to-Speech API key](https://console.cloud.google.com/apis/credentials) for higher quality voices
- Optional: Google Cloud Speech-to-Text or AssemblyAI for subtitle generation

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/cantonsir/open-neuralingo.git
   cd open-neuralingo
   ```

2. Install frontend dependencies
   ```bash
   npm install
   ```

3. Install backend dependencies
   ```bash
   python -m venv venv

   # Windows
   venv\Scripts\activate

   # macOS/Linux
   source venv/bin/activate

   pip install -r backend/requirements.txt
   ```

4. Configure environment variables
   ```bash
   cp .env.example .env.local
   ```
   Update `.env.local` with your API keys.

### Running the Application

Run both the backend and frontend servers.

Terminal 1 - Backend
```bash
python backend/run.py
C:\Users\Jayden\anaconda3\python.exe backend/run.py
```
Backend runs on http://localhost:3001

Terminal 2 - Frontend
```bash
npm run dev
```
Frontend runs on http://localhost:3000

Open http://localhost:3000 in your browser to use OpenNeuralingo.

## Configuration

See [.env.example](.env.example) for the full set of variables.

### Frontend (.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | Yes | Google Gemini API key for AI features |
| `VITE_CLOUD_TTS_API_KEY` | No | Google Cloud TTS key for higher quality voices |

### Backend (environment variables)

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_FILE` | No | SQLite database path (default: openneuralingo.db in project root) |
| `UPLOAD_FOLDER` | No | Upload directory (default: uploads) |
| `HOST` | No | Server host (default: 0.0.0.0) |
| `PORT` | No | Server port (default: 3001) |
| `DEBUG` | No | Debug mode (default: true) |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Google Cloud service account JSON for speech-to-text |
| `GOOGLE_SUBTITLES_BUCKET` | No | Cloud Storage bucket for long audio transcription |
| `ASSEMBLYAI_API_KEY` | No | AssemblyAI API key for fallback transcription |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the production build |

## API

Backend endpoint documentation is available in [backend/README.md](backend/README.md).

## Project Structure

```
open-neuralingo/
├── src/                    # Frontend source code
│   ├── components/         # React components by module
│   │   ├── common/         # Shared components
│   │   ├── listening/      # Listening module
│   │   ├── reading/        # Reading module
│   │   ├── speaking/       # Speaking module
│   │   └── writing/        # Writing module
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API and AI services
│   ├── context/            # React context providers
│   └── types.ts            # TypeScript type definitions
├── backend/                # Flask backend
│   ├── app/                # Application package
│   │   ├── routes/         # API route blueprints
│   │   ├── config.py       # Configuration
│   │   └── database.py     # Database management
│   └── run.py              # Entry point
├── index.html              # Vite entry point
├── vite.config.ts          # Vite configuration
└── package.json            # Node.js dependencies
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Create loop marker (snaps to subtitle) |
| `S` | Peek at subtitles |
| `K` or `P` | Play or pause video |
| `Left` | Previous sentence |
| `Right` | Next sentence |

## Troubleshooting

Port already in use
```bash
# Backend (3001)
npx kill-port 3001

# Frontend (3000)
npx kill-port 3000
```

Reset the database
```bash
# macOS/Linux
rm openneuralingo.db

# Windows (cmd)
del openneuralingo.db

# Windows (PowerShell)
Remove-Item openneuralingo.db
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
