"""
Database Migration: Add subtitles_json column

Adds subtitle storage columns to listening_sessions and practice_sessions tables.
Run this migration to enable subtitle functionality for AI-generated audio.
"""

import sqlite3
import os
from pathlib import Path


def migrate():
    """
    Add subtitles_json column to listening_sessions and practice_sessions tables.
    Safe to run multiple times - checks if columns exist before adding.
    """
    # Get database path - it's in the root directory as openneuralingo.db
    project_root = Path(__file__).parent.parent.parent.parent
    db_path = project_root / 'openneuralingo.db'
    
    if not db_path.exists():
        print(f"⚠️  Database not found at {db_path}")
        print("   Database will be created on first app run")
        return
    
    print(f"📁 Using database: {db_path}")
    
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()
    
    try:
        # Check and add to listening_sessions
        c.execute("PRAGMA table_info(listening_sessions)")
        columns = [col[1] for col in c.fetchall()]
        
        if 'subtitles_json' not in columns:
            print("🔄 Adding subtitles_json to listening_sessions...")
            c.execute("ALTER TABLE listening_sessions ADD COLUMN subtitles_json TEXT")
            print("✅ Added subtitles_json to listening_sessions")
        else:
            print("✓  listening_sessions.subtitles_json already exists")
        
        # Check and add to practice_sessions
        c.execute("PRAGMA table_info(practice_sessions)")
        columns = [col[1] for col in c.fetchall()]
        
        if 'subtitles_json' not in columns:
            print("🔄 Adding subtitles_json to practice_sessions...")
            c.execute("ALTER TABLE practice_sessions ADD COLUMN subtitles_json TEXT")
            print("✅ Added subtitles_json to practice_sessions")
        else:
            print("✓  practice_sessions.subtitles_json already exists")
        
        conn.commit()
        print("\n🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    print("=" * 60)
    print("Database Migration: Add Subtitle Support")
    print("=" * 60)
    migrate()
