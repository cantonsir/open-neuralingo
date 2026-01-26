# EchoLoop Backend API

This directory contains the Python/Flask backend for EchoLoop. It acts as a bridge between the React frontend, the SQLite database, and external services like YouTube Transcript API.

## 🛠️ Prerequisites

- Python 3.8+
- PIP

## 📦 Installation

1. Navigate to the backend directory (or root):
   ```bash
   cd deep-listening-trainer
   ```

2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
   *Note: It's recommended to use a virtual environment (`venv`).*

## 🚀 Running the Server

Run the server from the **root** directory of the project:

```bash
python backend/server.py
```

The API will be available at `http://localhost:5000`.

## 🗄️ Database

The application uses **SQLite** for data persistence.
- **File**: `echoloop.db` (created in the project root)
- **Schema**:
  - `flashcards`: Saved vocabulary cards/markers.
  - `watch_history`: History of watched videos.
  - `goal_videos`: Learning goals and progress.
  - `lesson_items`: Generated lesson content.
  - `assessment_profiles`: User level and settings.

## 🔌 API Endpoints

### Transcripts
- `GET /api/transcript?videoId={id}&language={lang}`: Fetch subtitles.
- `GET /api/transcript/languages?videoId={id}`: List available languages.

### Flashcards (Deck)
- `GET /api/cards`: List all saved cards.
- `POST /api/cards`: Save a new card.
- `PUT /api/cards/<id>`: Update a card.
- `DELETE /api/cards/<id>`: Delete a card.

### History
- `GET /api/history`: Get watch history.
- `POST /api/history`: Add to history.
- `DELETE /api/history`: Clear history.

### Learning & Assessment
- `POST /api/lessons/generate`: Generate AI lessons.
- `GET /api/goals`: Get learning goals.
