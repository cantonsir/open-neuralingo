# EchoLoop - AI-Powered Language Learning Platform

**Version:** 1.0.0
**Author:** Jayden (Cantonsir)
**License:** MIT
**Repository:** https://github.com/cantonsir/deep-listening-trainer

---

## Overview

EchoLoop is a comprehensive AI-powered language learning platform designed to help learners improve their listening, reading, speaking, and writing skills through interactive exercises, YouTube video analysis, and real-time conversation practice.

### Key Features

- **Listening Practice** - YouTube video playback with subtitle synchronization, loop markers, and shadowing exercises
- **Reading Module** - Import PDFs, EPUBs, and YouTube transcripts for comprehension practice
- **Speaking Module** - Real-time AI conversation with scenario-based roleplay
- **Writing Module** - Composition practice with AI-powered grammar correction
- **Spaced Repetition** - Anki-style flashcard system with SM-2 scheduling algorithm
- **Multi-Language Support** - 13+ target languages with AI-generated definitions

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 6.x | Build tool & dev server |
| Tailwind CSS | 4.1 | Styling |
| Recharts | 3.7 | Data visualization |
| Lucide React | 0.562 | Icons |
| React YouTube | 10.1 | Video player |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.10+ | Runtime |
| Flask | 3.0 | Web framework |
| SQLite | 3 | Database |
| youtube-transcript-api | 0.6 | Transcript extraction |
| PyPDF2 | 3.0 | PDF processing |
| EbookLib | 0.18 | EPUB handling |

### External Services
| Service | Purpose |
|---------|---------|
| Google Gemini API | AI content generation (gemini-2.0-flash) |
| Google Cloud TTS | High-quality text-to-speech |
| YouTube IFrame API | Video playback |

---

## State Management

### Core Application State (`App.tsx`)
The application uses React's built-in `useState` for managing high-level application state:
- **Active Module**: Tracks which main module is active (Listening, Reading, Speaking, Writing)
- **View Navigation**: Manages the current sub-view within modules (e.g., 'home', 'learning', 'assessment')
- **Global Settings**: Manages theme (dark/light) and language preferences

### Data Persistence
- **Flashcards**: Persisted in SQLite via the backend API
- **User Preferences**: `localStorage` is used for maximizing persistence of settings like Theme and Target Language
- **Context API**: `AppContext` is set up for future global state expansion

---

## Core Workflows

### Listening Practice Loop
1. **Search/Import**: User searches for a YouTube video or provides a URL.
2. **Setup**: Video loads with transcripts; user sets target/native languages.
3. **Listen & Loop**:
   - User watches video.
   - User typically presses `Space` to "loop" a difficult sentence.
   - User practices listening/shadowing this loop.
4. **Capture**: User marks specific words or phrases as "unknown".
5. **Review**: These marked items become Flashcards.
6. **Reinforce**: User reviews Flashcards in the dedicated generic flashcard interface using the Spaced Repetition System.

---

## Project Structure

```
deep-listening-trainer/
├── backend/                # Flask Backend
│   ├── run.py              # Application entry point
│   └── app/
│       ├── __init__.py     # Flask app factory
│       ├── config.py       # Configuration
│       ├── database.py     # SQLite management
│       └── routes/         # API blueprints
│
├── src/                    # React Frontend
│   ├── App.tsx             # Main application router
│   ├── main.tsx            # React entry point
│   ├── types.ts            # TypeScript interfaces
│   ├── db.ts               # API client
│   ├── ai.ts               # AI helper functions
│   │
│   ├── components/
│   │   ├── common/         # Shared components
│   │   │   ├── Sidebar.tsx
│   │   │   └── SettingsPanel.tsx
│   │   │
│   │   ├── listening/      # Listening module
│   │   │   ├── ListeningModule.tsx
│   │   │   └── LoopView.tsx
│   │   │
│   │   ├── reading/        # Reading module
│   │   │   ├── ReadingView.tsx
│   │   │   └── ReadingLibrary.tsx
│   │   │
│   │   ├── speaking/       # Speaking module
│   │   │   ├── SpeakingView.tsx
│   │   │   └── LiveConversation.tsx
│   │   │
│   │   └── writing/        # Writing module
│   │       ├── WritingView.tsx
│   │       └── WritingCompose.tsx
│   │
│   └── services/           # External service integrations
│       ├── geminiService.ts
│       └── ttsService.ts
│
├── uploads/                # Uploaded PDF/EPUB files
├── echoloop.db             # SQLite database
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

---

## Configuration

### Vite (vite.config.ts)
- Dev server: port 3000
- API proxy: http://127.0.0.1:3001
- Path alias: `@/` → `./` (Root)

### TypeScript (tsconfig.json)
- Target: ES2022
- Strict mode enabled
- Path alias: `@/*` → `./src/*`
- NOTE: The codebase primarily uses relative paths for imports.

### Supported Languages

Target languages: English, Spanish, French, German, Japanese, Korean, Mandarin, Cantonese, Portuguese, Russian, Italian, Arabic, Hindi

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           React Frontend (Port 3000)        │
│  ┌───────────────────────────────────────┐  │
│  │  Listening │ Reading │ Speaking │ Writing │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │  geminiService │ ttsService │ db.ts   │  │
│  └───────────────────────────────────────┘  │
└──────────────────┬──────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────┐
│           Flask Backend (Port 3001)         │
│  ┌───────────────────────────────────────┐  │
│  │  Routes: flashcards, assessment,      │  │
│  │  goals, library, transcript           │  │
│  └───────────────────────────────────────┘  │
└──────────────────┬──────────────────────────┘
                   │ SQL
┌──────────────────▼──────────────────────────┐
│           SQLite (echoloop.db)              │
│  flashcards, goals, assessments, library    │
└─────────────────────────────────────────────┘

External: Gemini API, YouTube API, Cloud TTS
```

---

## Troubleshooting

**Port conflicts:**
```bash
npx kill-port 3001  # Kill backend
npx kill-port 3000  # Kill frontend
```

**Reset database:**
```bash
rm echoloop.db
# Restart backend to recreate tables
```

**Python environment issues:**
```bash
# Use specific Python path if needed
C:\Users\Jayden\anaconda3\python.exe backend/run.py
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT License - see [LICENSE](LICENSE) for details.
