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
    
    # Legacy flashcards table (kept for backward compatibility)
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
    
    # Module-specific flashcard tables
    # Listening flashcards
    c.execute('''
        CREATE TABLE IF NOT EXISTS listening_flashcards (
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
            press_count INTEGER,
            source TEXT DEFAULT 'loop',
            ease_factor REAL DEFAULT 2.5,
            interval_days INTEGER DEFAULT 0,
            repetitions INTEGER DEFAULT 0,
            next_review_date TEXT,
            last_reviewed_at INTEGER,
            custom_tags TEXT,
            card_state TEXT DEFAULT 'new',
            learning_step INTEGER DEFAULT 0,
            due_timestamp INTEGER
        )
    ''')
    
    # Speaking flashcards
    c.execute('''
        CREATE TABLE IF NOT EXISTS speaking_flashcards (
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
            press_count INTEGER,
            source TEXT,
            ease_factor REAL DEFAULT 2.5,
            interval_days INTEGER DEFAULT 0,
            repetitions INTEGER DEFAULT 0,
            next_review_date TEXT,
            last_reviewed_at INTEGER,
            custom_tags TEXT,
            card_state TEXT DEFAULT 'new',
            learning_step INTEGER DEFAULT 0,
            due_timestamp INTEGER
        )
    ''')
    
    # Reading flashcards
    c.execute('''
        CREATE TABLE IF NOT EXISTS reading_flashcards (
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
            press_count INTEGER,
            source TEXT,
            ease_factor REAL DEFAULT 2.5,
            interval_days INTEGER DEFAULT 0,
            repetitions INTEGER DEFAULT 0,
            next_review_date TEXT,
            last_reviewed_at INTEGER,
            custom_tags TEXT,
            card_state TEXT DEFAULT 'new',
            learning_step INTEGER DEFAULT 0,
            due_timestamp INTEGER
        )
    ''')
    
    # Writing flashcards
    c.execute('''
        CREATE TABLE IF NOT EXISTS writing_flashcards (
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
            press_count INTEGER,
            source TEXT,
            ease_factor REAL DEFAULT 2.5,
            interval_days INTEGER DEFAULT 0,
            repetitions INTEGER DEFAULT 0,
            next_review_date TEXT,
            last_reviewed_at INTEGER,
            custom_tags TEXT,
            card_state TEXT DEFAULT 'new',
            learning_step INTEGER DEFAULT 0,
            due_timestamp INTEGER
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

    # Assessment Analytics table for cached statistics
    c.execute('''
        CREATE TABLE IF NOT EXISTS assessment_analytics (
            id TEXT PRIMARY KEY,
            computed_at INTEGER NOT NULL,
            time_window TEXT NOT NULL,
            total_tests INTEGER,
            score_data_json TEXT,
            weakness_data_json TEXT,
            stats_json TEXT
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

    # Practice Sessions table for AI-generated practice dialogues
    c.execute('''
        CREATE TABLE IF NOT EXISTS practice_sessions (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL,
            segment_index INTEGER NOT NULL,
            prompt TEXT NOT NULL,
            model_used TEXT NOT NULL,
            attached_contexts TEXT,
            transcript_json TEXT NOT NULL,
            audio_urls TEXT,
            duration_seconds INTEGER,
            command_used TEXT,
            created_at INTEGER NOT NULL,
            is_favorite BOOLEAN DEFAULT 0,
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
    
    # Listening table
    c.execute('''
        CREATE TABLE IF NOT EXISTS listening_sessions (
            id TEXT PRIMARY KEY,
            prompt TEXT,
            audio_url TEXT,
            transcript_json TEXT,
            duration_seconds INTEGER,
            context_id TEXT,
            created_at INTEGER
        )
    ''')

    # Listening feedback sessions
    c.execute('''
        CREATE TABLE IF NOT EXISTS listening_feedback_sessions (
            id TEXT PRIMARY KEY,
            video_id TEXT,
            video_title TEXT,
            marker_snapshot_json TEXT,
            feedback_json TEXT,
            context_id TEXT,
            created_at INTEGER
        )
    ''')
    
    # Reading table
    c.execute('''
        CREATE TABLE IF NOT EXISTS reading_sessions (
            id TEXT PRIMARY KEY,
            prompt TEXT,
            title TEXT,
            content TEXT,
            context_id TEXT,
            created_at INTEGER
        )
    ''')
    
    # Review log table (Anki-style) - tracks every single review
    c.execute('''
        CREATE TABLE IF NOT EXISTS review_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT NOT NULL,
            module TEXT NOT NULL,
            reviewed_at INTEGER NOT NULL,
            rating TEXT NOT NULL,
            card_state_before TEXT,
            card_state_after TEXT,
            interval_before INTEGER,
            interval_after INTEGER,
            ease_factor_before REAL,
            ease_factor_after REAL,
            time_taken_ms INTEGER
        )
    ''')
    
    # Index for efficient queries on review_log
    c.execute('''
        CREATE INDEX IF NOT EXISTS idx_review_log_card_id ON review_log(card_id)
    ''')
    c.execute('''
        CREATE INDEX IF NOT EXISTS idx_review_log_reviewed_at ON review_log(reviewed_at)
    ''')
    c.execute('''
        CREATE INDEX IF NOT EXISTS idx_review_log_module ON review_log(module)
    ''')
    
    conn.commit()
    conn.close()


def migrate_db():
    """
    Run database migrations to add new columns to existing tables.
    """
    from datetime import date
    
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
    
    # Migration: Add source column if it doesn't exist in flashcards
    try:
        c.execute("SELECT source FROM flashcards LIMIT 1")
    except sqlite3.OperationalError:
        print("Migrating: Adding 'source' column to flashcards table...")
        c.execute("ALTER TABLE flashcards ADD COLUMN source TEXT DEFAULT 'loop'")
        conn.commit()
        print("Migration complete.")
    
    # Migration: Copy data from old flashcards table to listening_flashcards
    try:
        # Check if listening_flashcards is empty and flashcards has data
        old_count = c.execute("SELECT COUNT(*) FROM flashcards").fetchone()[0]
        new_count = c.execute("SELECT COUNT(*) FROM listening_flashcards").fetchone()[0]
        
        if old_count > 0 and new_count == 0:
            print(f"Migrating: Copying {old_count} cards from flashcards to listening_flashcards...")
            c.execute('''
                INSERT INTO listening_flashcards 
                (id, video_id, start_time, end_time, subtitle_text, created_at, 
                 vocab_data, misunderstood_indices, tags, note, press_count, source)
                SELECT id, video_id, start_time, end_time, subtitle_text, created_at,
                       vocab_data, misunderstood_indices, tags, note, press_count, 
                       COALESCE(source, 'loop')
                FROM flashcards
            ''')
            conn.commit()
            print(f"Migration complete: {old_count} cards copied.")
    except sqlite3.OperationalError as e:
        print(f"Migration skipped (tables may not exist yet): {e}")
    
    # Migration: Add SM-2 SRS columns to all flashcard tables
    flashcard_tables = ['listening_flashcards', 'speaking_flashcards', 'reading_flashcards', 'writing_flashcards']
    srs_columns = [
        ('ease_factor', 'REAL DEFAULT 2.5'),
        ('interval_days', 'INTEGER DEFAULT 0'),
        ('repetitions', 'INTEGER DEFAULT 0'),
        ('next_review_date', 'TEXT'),
        ('last_reviewed_at', 'INTEGER'),
        ('custom_tags', 'TEXT'),
        # Learning queue columns (Anki-style)
        ('card_state', "TEXT DEFAULT 'new'"),
        ('learning_step', 'INTEGER DEFAULT 0'),
        ('due_timestamp', 'INTEGER')
    ]
    
    today = date.today().isoformat()
    
    for table in flashcard_tables:
        for col_name, col_type in srs_columns:
            try:
                c.execute(f"SELECT {col_name} FROM {table} LIMIT 1")
            except sqlite3.OperationalError:
                print(f"Migrating: Adding '{col_name}' column to {table} table...")
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
                conn.commit()
                print(f"Migration complete: Added {col_name} to {table}.")
        
        # Set next_review_date to today for existing cards that don't have it
        try:
            c.execute(f"UPDATE {table} SET next_review_date = ? WHERE next_review_date IS NULL", (today,))
            conn.commit()
        except sqlite3.OperationalError as e:
            print(f"Could not set default next_review_date for {table}: {e}")
        
        # Set card_state for existing cards based on their review history
        try:
            # Cards never reviewed = 'new'
            # Cards with interval >= 1 day = 'review'
            # Cards with interval < 1 day but reviewed = 'learning'
            c.execute(f"""
                UPDATE {table} SET card_state = 
                    CASE 
                        WHEN last_reviewed_at IS NULL THEN 'new'
                        WHEN interval_days >= 1 THEN 'review'
                        ELSE 'learning'
                    END
                WHERE card_state IS NULL OR card_state = ''
            """)
            conn.commit()
        except sqlite3.OperationalError as e:
            print(f"Could not set card_state for {table}: {e}")
    
    conn.close()


def ensure_upload_folder():
    """
    Ensure the upload folder exists.
    """
    if not os.path.exists(Config.UPLOAD_FOLDER):
        os.makedirs(Config.UPLOAD_FOLDER)
