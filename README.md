# EchoLoop – Deep Listening Trainer

EchoLoop is a premium, web-based tool designed for language learners and anyone looking to improve their listening comprehension. It combines precise YouTube playback with automatic subtitle snapping, allowing you to drill down on difficult pronunciations and manage a persistent vocabulary database.

<div align="center">
  <img width="1200" alt="EchoLoop Dashboard" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## ✨ Key Features

- **Match Subtitles Instantly**: Press `Space` to create a loop marker. The app snaps the loop effectively to the exact start and end of the current sentence.
- **Persistent Database**: Save difficult phrases to your local database (SQLite) and manage them later.
- **Review & Clean Up**: Use the **Database Management Panel** to review saved cards, edit definitions, and delete mastered items.
- **Subtitle Peeking**: Keep subtitles hidden to challenge yourself, then press `S` to "peek" at the text.
- **Precision Looping**: Loop any segment indefinitely.
- **AI Definitions**: Integrate with Gemini API to auto-generate definitions for marked words.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS
- **Backend**: Python (Flask)
- **Database**: SQLite (Local file: `backend/flashcards.db`)
- **Video**: `react-youtube` API

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python 3](https://python.org)

### 2. Installation

Clone the repository:
```bash
git clone https://github.com/cantonsir/deep-listening-trainer.git
cd deep-listening-trainer
```

Install Frontend dependencies:
```bash
npm install
```

Install Backend dependencies:
```bash
python -m pip install -r backend/requirements.txt
```

### 3. Configuration
Set your `GEMINI_API_KEY` in `.env.local` for AI features:
```env
GEMINI_API_KEY=your_key_here
```

### 4. Running the App
You need to run **both** the backend and frontend terminals.

**Terminal 1 (Backend - SQLite API)**:
```bash
python backend/server.py
```
*(Runs on http://localhost:5000)*

**Terminal 2 (Frontend - React App)**:
```bash
npm run dev
```
*(Runs on http://localhost:3000)*

## ⌨️ Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Create Loop Marker (Snaps to subtitle) |
| `S` | Peek Subtitles |
| `K` / `P` | Play / Pause |
| `←` / `→` | Prev / Next Sentence |

---
Created with ❤️ for language learners.
