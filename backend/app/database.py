"""
Database Module

Handles database initialization, migrations, and connection management.
"""

import os
import sqlite3
from contextlib import contextmanager

from app.config import Config


def get_db_connection():
    """
    Get a database connection with row factory enabled.
    
    Returns:
        sqlite3.Connection: Database connection object
    """
    conn = sqlite3.connect(Config.DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db():
    """
    Context manager for database connections.
    Automatically handles connection cleanup.
    
    Yields:
        sqlite3.Connection: Database connection object
    """
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """
    Initialize the database with all required tables.
    Creates tables if they don't exist.
    """
    conn = sqlite3.connect(Config.DB_FILE)
    c = conn.cursor()
    
    # Flashcards table
    c.execute('''
        CREATE TABLE IF NOT EXISTS flashcards (
            id TEXT PRIMARY KEY,
            video_id TEXT,
            start_time REAL,
            end_time REAL,
            subtitle_text TEXT,
            created_at INTEGER,
            vocab_data TEXT,
            misunderstood_indices TEXT,
            tags TEXT,
            note TEXT,
            press_count INTEGER
        )
    ''')
    
    # Watch history table
    c.execute('''
        CREATE TABLE IF NOT EXISTS watch_history (
            video_id TEXT PRIMARY KEY,
            title TEXT,
            thumbnail TEXT,
            watched_at INTEGER,
            duration TEXT,
            words_learned INTEGER DEFAULT 0
        )
    ''')
    
    # Learning Session tables
    c.execute('''
        CREATE TABLE IF NOT EXISTS lesson_items (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            segment_index INTEGER NOT NULL,
            original_text TEXT NOT NULL,
            variations TEXT NOT NULL,
            audio_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS lesson_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL,
            attempts INTEGER DEFAULT 0,
            understood INTEGER DEFAULT 0,
            last_seen TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES lesson_items(id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS segment_progress (
            video_id TEXT NOT NULL,
            segment_index INTEGER NOT NULL,
            total_items INTEGER DEFAULT 0,
            completed_items INTEGER DEFAULT 0,
            is_unlocked BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (video_id, segment_index)
        )
    ''')
    
    # Goal Videos table for Learning Section
    c.execute('''
        CREATE TABLE IF NOT EXISTS goal_videos (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            title TEXT,
            thumbnail TEXT,
            language TEXT DEFAULT 'en',
            duration_seconds INTEGER DEFAULT 0,
            segment_duration INTEGER DEFAULT 240,
            total_segments INTEGER DEFAULT 0,
            completed_segments INTEGER DEFAULT 0,
            overall_progress REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_studied_at TIMESTAMP,
            transcript TEXT
        )
    ''')
    
    # Assessment & Mini-Test tables
    c.execute('''
        CREATE TABLE IF NOT EXISTS assessment_profiles (
            id TEXT PRIMARY KEY,
            target_language TEXT DEFAULT 'en',
            target_content TEXT DEFAULT 'general',
            listening_level INTEGER DEFAULT 2,
            subtitle_dependence INTEGER DEFAULT 1,
            difficulties TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS mini_test_results (
            id TEXT PRIMARY KEY,
            taken_at INTEGER,
            score INTEGER,
            total_questions INTEGER,
            analysis_json TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS mini_test_details (
            id TEXT PRIMARY KEY,
            result_id TEXT NOT NULL,
            question_index INTEGER,
            sentence TEXT,
            understood BOOLEAN,
            replays INTEGER,
            reaction_time_ms INTEGER,
            marked_indices TEXT,
            FOREIGN KEY (result_id) REFERENCES mini_test_results(id)
        )
    ''')
    
    # Segment Learning: Test-Learn-Watch Flow
    c.execute('''
        CREATE TABLE IF NOT EXISTS segment_tests (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL,
            segment_index INTEGER NOT NULL,
            attempt_number INTEGER DEFAULT 1,
            sentences_json TEXT NOT NULL,
            taken_at INTEGER,
            score INTEGER DEFAULT 0,
            total_questions INTEGER DEFAULT 5,
            accuracy REAL DEFAULT 0.0,
            analysis_json TEXT,
            FOREIGN KEY (goal_id) REFERENCES goal_videos(id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS segment_test_details (
            id TEXT PRIMARY KEY,
            test_id TEXT NOT NULL,
            question_index INTEGER,
            sentence TEXT,
            understood BOOLEAN,
            replays INTEGER DEFAULT 0,
            reaction_time_ms INTEGER DEFAULT 0,
            marked_indices TEXT,
            FOREIGN KEY (test_id) REFERENCES segment_tests(id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS segment_lessons (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL,
            segment_index INTEGER NOT NULL,
            test_id TEXT,
            lesson_type TEXT,
            content_json TEXT NOT NULL,
            created_at INTEGER,
            completed BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (goal_id) REFERENCES goal_videos(id),
            FOREIGN KEY (test_id) REFERENCES segment_tests(id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS segment_mastery (
            goal_id TEXT NOT NULL,
            segment_index INTEGER NOT NULL,
            test_attempts INTEGER DEFAULT 0,
            best_accuracy REAL DEFAULT 0.0,
            is_mastered BOOLEAN DEFAULT FALSE,
            video_watched BOOLEAN DEFAULT FALSE,
            last_test_at INTEGER,
            PRIMARY KEY (goal_id, segment_index),
            FOREIGN KEY (goal_id) REFERENCES goal_videos(id)
        )
    ''')
    
    # Library table
    c.execute('''
        CREATE TABLE IF NOT EXISTS library (
            id TEXT PRIMARY KEY,
            title TEXT,
            filename TEXT,
            file_type TEXT,
            content_text TEXT,
            created_at INTEGER
        )
    ''')
    
    # Speaking tables
    c.execute('''
        CREATE TABLE IF NOT EXISTS speaking_conversations (
            id TEXT PRIMARY KEY,
            topic TEXT,
            script_json TEXT,
            audio_paths_json TEXT,
            created_at INTEGER
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS speaking_sessions (
            id TEXT PRIMARY KEY,
            topic TEXT,
            transcript_json TEXT,
            duration_seconds INTEGER,
            created_at INTEGER
        )
    ''')
    
    # Writing table
    c.execute('''
        CREATE TABLE IF NOT EXISTS writing_sessions (
            id TEXT PRIMARY KEY,
            topic TEXT,
            content TEXT,
            context_id TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )
    ''')
    
    conn.commit()
    conn.close()


def migrate_db():
    """
    Run database migrations to add new columns to existing tables.
    """
    conn = sqlite3.connect(Config.DB_FILE)
    c = conn.cursor()
    
    # Migration: Add language column if it doesn't exist in goal_videos
    try:
        c.execute("SELECT language FROM goal_videos LIMIT 1")
    except sqlite3.OperationalError:
        print("Migrating: Adding 'language' column to goal_videos table...")
        c.execute("ALTER TABLE goal_videos ADD COLUMN language TEXT DEFAULT 'en'")
        conn.commit()
        print("Migration complete.")
    
    conn.close()


def ensure_upload_folder():
    """
    Ensure the upload folder exists.
    """
    if not os.path.exists(Config.UPLOAD_FOLDER):
        os.makedirs(Config.UPLOAD_FOLDER)
