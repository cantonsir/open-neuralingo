# OpenNeuralingo Backend

A modular Flask API server for the OpenNeuralingo language learning application.

## 📁 Project Structure

```
backend/
├── app/                      # Application package
│   ├── __init__.py          # App factory (create_app)
│   ├── config.py            # Configuration management
│   ├── database.py          # Database initialization & helpers
│   └── routes/              # API route blueprints
│       ├── __init__.py
│       ├── transcript.py    # YouTube transcript endpoints
│       ├── flashcards.py    # Flashcard CRUD operations
│       ├── history.py       # Watch history management
│       ├── lessons.py       # Lesson generation & progress
│       ├── goals.py         # Learning goal videos
│       ├── assessment.py    # Assessment profiles & results
│       ├── segment_learning.py  # Test-Learn-Watch flow
│       ├── library.py       # File uploads & content library
│       ├── speaking.py      # Speaking session history
│       └── writing.py       # Writing session management
├── uploads/                  # Uploaded files (PDF, EPUB)
├── run.py                    # Application entry point
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Server

```bash
# Default: http://0.0.0.0:3001
python run.py

# Custom port
python run.py --port 5000

# Production mode (debug off)
python run.py --no-debug
```

## 📚 API Endpoints

### Transcripts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transcript?videoId=ID&language=en` | Fetch YouTube transcript |
| GET | `/api/transcript/languages?videoId=ID` | Get available languages |

### Flashcards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cards` | Get all flashcards |
| POST | `/api/cards` | Create flashcard |
| PUT | `/api/cards/:id` | Update flashcard |
| DELETE | `/api/cards/:id` | Delete flashcard |

### Watch History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | Get watch history |
| POST | `/api/history` | Add to history |
| DELETE | `/api/history/:videoId` | Remove from history |
| DELETE | `/api/history` | Clear all history |

### Goals (Learning Videos)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals` | List all goals |
| POST | `/api/goals` | Add new goal |
| GET | `/api/goals/:id` | Get goal with segments |
| DELETE | `/api/goals/:id` | Delete goal |
| GET | `/api/goals/:id/segment/:idx/sentences` | Get segment sentences |

### Lessons
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lessons/generate` | Generate lessons from transcript |
| GET | `/api/lessons/:videoId/:segmentIndex` | Get segment lessons |
| POST | `/api/lessons/:itemId/progress` | Update lesson progress |
| PUT | `/api/lessons/:itemId/variations` | Store AI variations |
| GET | `/api/segments/:videoId` | Get all segment progress |

### Assessment
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assessment/profile` | Get user profile |
| POST | `/api/assessment/profile` | Save profile |
| GET | `/api/assessment/results` | Get test results |
| POST | `/api/assessment/results` | Save test result |

### Segment Learning (Test-Learn-Watch)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/segment-learning/:goalId/:idx/mastery` | Get mastery status |
| POST | `/api/segment-learning/:goalId/:idx/test` | Save test result |
| GET | `/api/segment-learning/:goalId/:idx/tests` | Get all tests |
| POST | `/api/segment-learning/:goalId/:idx/lessons` | Save lessons |
| GET | `/api/segment-learning/:goalId/:idx/lessons` | Get lessons |
| POST | `/api/segment-learning/:goalId/:idx/lessons/:id/complete` | Complete lesson |
| POST | `/api/segment-learning/:goalId/:idx/watch` | Mark as watched |

### Library
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload PDF/EPUB |
| GET | `/api/library` | List library items |
| POST | `/api/library/import/youtube` | Import from YouTube |
| GET | `/api/library/:id/content` | Get item content |
| DELETE | `/api/library/:id` | Delete item |

### Speaking
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/speaking/sessions` | Get sessions |
| POST | `/api/speaking/sessions` | Save session |

### Writing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/writing/sessions` | Get sessions |
| POST | `/api/writing/sessions` | Save session |

## ⚙️ Configuration

Environment variables (or modify `app/config.py`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_FILE` | `openneuralingo.db` | SQLite database file |
| `UPLOAD_FOLDER` | `uploads` | Upload directory |
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `3001` | Server port |
| `DEBUG` | `true` | Debug mode |

## 🏗️ Architecture

This backend follows a clean modular architecture:

- **App Factory Pattern**: `create_app()` enables testing and multiple configurations
- **Blueprints**: Routes organized by domain (flashcards, goals, etc.)
- **Configuration Class**: Centralized config with environment overrides
- **Database Module**: Single source for DB operations and migrations

## 🧪 Development

### Adding a New Route

1. Create a new file in `app/routes/`
2. Define a Blueprint
3. Register in `app/__init__.py`

Example:
```python
# app/routes/my_feature.py
from flask import Blueprint, jsonify

my_feature_bp = Blueprint('my_feature', __name__)

@my_feature_bp.route('/my-feature', methods=['GET'])
def get_feature():
    return jsonify({'status': 'ok'})
```

### Database Migrations

Add new migrations to `app/database.py` in the `migrate_db()` function.

## 📄 License

MIT License
