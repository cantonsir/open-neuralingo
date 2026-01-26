import sqlite3
import json
import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi

app = Flask(__name__)
CORS(app)

DB_FILE = 'echoloop.db'

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
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
            difficulties TEXT, -- JSON list
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
            analysis_json TEXT -- Full analysis object
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
            marked_indices TEXT, -- JSON list
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
            sentences_json TEXT NOT NULL, -- AI-generated test sentences
            taken_at INTEGER,
            score INTEGER DEFAULT 0,
            total_questions INTEGER DEFAULT 5,
            accuracy REAL DEFAULT 0.0,
            analysis_json TEXT, -- AI feedback after test
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
            marked_indices TEXT, -- JSON list of word indices user couldn't catch
            FOREIGN KEY (test_id) REFERENCES segment_tests(id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS segment_lessons (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL,
            segment_index INTEGER NOT NULL,
            test_id TEXT, -- Which test generated this lesson
            lesson_type TEXT, -- 'vocabulary', 'pattern', 'slow_practice', etc.
            content_json TEXT NOT NULL, -- Lesson content (varies by type)
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
    conn.commit()
    conn.close()

# Initialize DB on start
if not os.path.exists(DB_FILE):
    init_db()
else:
    # Ensure table exists even if file exists (e.g. empty file)
    init_db()

# Migration: Add language column if it doesn't exist
def migrate_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # Check if language column exists in goal_videos
    try:
        c.execute("SELECT language FROM goal_videos LIMIT 1")
    except sqlite3.OperationalError:
        # Column doesn't exist, add it
        print("Migrating: Adding 'language' column to goal_videos table...")
        c.execute("ALTER TABLE goal_videos ADD COLUMN language TEXT DEFAULT 'en'")
        conn.commit()
        print("Migration complete.")
    conn.close()

migrate_db()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/transcript', methods=['GET'])
def get_transcript():
    video_id = request.args.get('videoId')
    language = request.args.get('language', 'en')  # Default to English
    
    if not video_id:
        return jsonify({'error': 'Missing videoId parameter'}), 400

    try:
        # Initializing the API client (required for this version of the library)
        ytt_api = YouTubeTranscriptApi()
        
        # Try to fetch the specified language
        try:
            transcript_obj = ytt_api.fetch(video_id, languages=[language])
        except Exception:
            # Fallback: try to get any available transcript
            transcript_obj = ytt_api.fetch(video_id)
        
        # Convert to list of dicts using the method provided by the library
        transcript_data = transcript_obj.to_raw_data()
        
        return jsonify(transcript_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcript/languages', methods=['GET'])
def get_transcript_languages():
    """Get available subtitle languages for a YouTube video"""
    video_id = request.args.get('videoId')
    
    if not video_id:
        return jsonify({'error': 'Missing videoId parameter'}), 400

    try:
        ytt_api = YouTubeTranscriptApi()
        
        # List available transcripts - returns a TranscriptList object
        transcript_list = ytt_api.list(video_id)
        
        languages = []
        # TranscriptList has manual_transcripts and generated_transcripts attributes
        # but also supports iteration
        try:
            # Try to iterate directly
            for transcript in transcript_list:
                languages.append({
                    'code': transcript.language_code,
                    'name': transcript.language,
                    'isGenerated': transcript.is_generated,
                    'isTranslatable': transcript.is_translatable
                })
        except Exception:
            # Fallback: access the underlying dictionaries
            for lang_code, transcript in transcript_list._manually_created_transcripts.items():
                languages.append({
                    'code': lang_code,
                    'name': transcript.language,
                    'isGenerated': False,
                    'isTranslatable': transcript.is_translatable
                })
            for lang_code, transcript in transcript_list._generated_transcripts.items():
                languages.append({
                    'code': lang_code,
                    'name': transcript.language,
                    'isGenerated': True,
                    'isTranslatable': transcript.is_translatable
                })
        
        return jsonify({
            'videoId': video_id,
            'languages': languages,
            'count': len(languages)
        })
    except Exception as e:
        import traceback
        print(f"Error fetching languages: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

# --- Flashcard API ---

@app.route('/api/cards', methods=['GET'])
def get_cards():
    try:
        conn = get_db_connection()
        cards = conn.execute('SELECT * FROM flashcards ORDER BY created_at DESC').fetchall()
        conn.close()
        
        card_list = []
        for card in cards:
            c = dict(card)
            # Parse JSON fields
            try: c['vocab_data'] = json.loads(c['vocab_data']) if c['vocab_data'] else {}
            except: c['vocab_data'] = {}
            
            try: c['misunderstood_indices'] = json.loads(c['misunderstood_indices']) if c['misunderstood_indices'] else []
            except: c['misunderstood_indices'] = []
            
            try: c['tags'] = json.loads(c['tags']) if c['tags'] else []
            except: c['tags'] = []

            # Map DB fields to Frontend specific Marker fields (camelCase)
            marker = {
                'id': c['id'],
                'videoId': c['video_id'],
                'start': c['start_time'],
                'end': c['end_time'],
                'subtitleText': c['subtitle_text'],
                'createdAt': c['created_at'],
                'vocabData': c['vocab_data'],
                'misunderstoodIndices': c['misunderstood_indices'],
                'tags': c['tags'],
                'note': c['note'],
                'press_count': c['press_count']
            }
            # Add videoId separately if needed, but Marker type doesn't strictly have it in frontend usage yet 
            # (it usually assumes context of current video, but for global deck we might need it. 
            # user's Marker type doesn't show videoId, let's check types.ts later if we need to add it there)
            # For now, we store it but maybe don't send it if frontend doesn't expect it, OR send it effectively.
            
            card_list.append(marker)
            
        return jsonify(card_list)
    except Exception as e:
         return jsonify({'error': str(e)}), 500

@app.route('/api/cards', methods=['POST'])
def save_card():
    card = request.json
    if not card:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        conn = get_db_connection()
        conn.execute('''
            INSERT OR REPLACE INTO flashcards 
            (id, video_id, start_time, end_time, subtitle_text, created_at, vocab_data, misunderstood_indices, tags, note, press_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            card['id'],
            card.get('videoId', ''), # Frontend might send this if we update it
            card['start'],
            card['end'],
            card.get('subtitleText', ''),
            card['createdAt'],
            json.dumps(card.get('vocabData', {})),
            json.dumps(card.get('misunderstoodIndices', [])),
            json.dumps(card.get('tags', [])),
            card.get('note', ''),
            card.get('pressCount', 0)
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'id': card['id']}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cards/<card_id>', methods=['DELETE'])
def delete_card(card_id):
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM flashcards WHERE id = ?', (card_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cards/<card_id>', methods=['PUT'])
def update_card(card_id):
    updates = request.json
    if not updates:
        return jsonify({'error': 'No data provided'}), 400

    try:
        conn = get_db_connection()
        
        # We handle specific partial updates or full updates. 
        # For simplicity, let's assume we might receive specific fields to update.
        # But commonly in this app, we update vocabData, note, or pressCount.
        
        # Dynamic update construction
        fields = []
        values = []
        
        if 'vocabData' in updates:
            fields.append('vocab_data = ?')
            values.append(json.dumps(updates['vocabData']))
        if 'note' in updates:
            fields.append('note = ?')
            values.append(updates['note'])
        if 'pressCount' in updates:
            fields.append('press_count = ?')
            values.append(updates['pressCount'])
        if 'misunderstoodIndices' in updates:
             fields.append('misunderstood_indices = ?')
             values.append(json.dumps(updates['misunderstoodIndices']))
            
        if not fields:
             return jsonify({'status': 'no chnages'}), 200

        values.append(card_id)
        query = f'UPDATE flashcards SET {", ".join(fields)} WHERE id = ?'
        
        conn.execute(query, values)
        conn.commit()
        conn.close()
        return jsonify({'status': 'updated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Watch History API ---

@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        conn = get_db_connection()
        items = conn.execute('SELECT * FROM watch_history ORDER BY watched_at DESC').fetchall()
        conn.close()
        
        history_list = []
        for item in items:
            h = dict(item)
            history_list.append({
                'videoId': h['video_id'],
                'title': h['title'],
                'thumbnail': h['thumbnail'],
                'watchedAt': h['watched_at'],
                'duration': h['duration'],
                'wordsLearned': h['words_learned']
            })
        return jsonify(history_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history', methods=['POST'])
def save_history():
    item = request.json
    if not item:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        conn = get_db_connection()
        conn.execute('''
            INSERT OR REPLACE INTO watch_history 
            (video_id, title, thumbnail, watched_at, duration, words_learned)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            item['videoId'],
            item.get('title', ''),
            item.get('thumbnail', ''),
            item.get('watchedAt', 0),
            item.get('duration', ''),
            item.get('wordsLearned', 0)
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history/<video_id>', methods=['DELETE'])
def delete_history_item(video_id):
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM watch_history WHERE video_id = ?', (video_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history', methods=['DELETE'])
def clear_history():
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM watch_history')
        conn.commit()
        conn.close()
        return jsonify({'status': 'cleared'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Learning Session API ---

@app.route('/api/lessons/generate', methods=['POST'])
def generate_lessons():
    """Generate lesson items from video transcript segment"""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_id = data.get('videoId')
    segment_index = data.get('segmentIndex', 0)
    transcript_text = data.get('transcriptText', '')  # List of sentences
    user_level = data.get('userLevel', 'intermediate')  # beginner, intermediate, advanced
    
    if not video_id or not transcript_text:
        return jsonify({'error': 'Missing videoId or transcriptText'}), 400
    
    try:
        conn = get_db_connection()
        
        # Check if lessons already exist for this segment
        existing = conn.execute(
            'SELECT id FROM lesson_items WHERE video_id = ? AND segment_index = ?',
            (video_id, segment_index)
        ).fetchall()
        
        if existing:
            conn.close()
            return jsonify({'status': 'exists', 'message': 'Lessons already generated for this segment'}), 200
        
        # Parse transcript - expected as list of sentence strings
        sentences = transcript_text if isinstance(transcript_text, list) else [transcript_text]
        
        items_created = []
        for sentence in sentences:
            if not sentence.strip():
                continue
                
            item_id = str(uuid.uuid4())
            
            # For now, store original text. AI variations will be generated on-demand via frontend
            # This allows us to use Gemini API from frontend with user's API key
            conn.execute('''
                INSERT INTO lesson_items (id, video_id, segment_index, original_text, variations, audio_data)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                item_id,
                video_id,
                segment_index,
                sentence.strip(),
                json.dumps([]),  # Variations to be filled by AI later
                json.dumps([])   # Audio data to be filled later
            ))
            
            # Initialize progress for this item
            conn.execute('''
                INSERT INTO lesson_progress (item_id, attempts, understood, last_seen)
                VALUES (?, 0, 0, NULL)
            ''', (item_id,))
            
            items_created.append({
                'id': item_id,
                'originalText': sentence.strip()
            })
        
        # Update segment progress
        conn.execute('''
            INSERT OR REPLACE INTO segment_progress (video_id, segment_index, total_items, completed_items, is_unlocked)
            VALUES (?, ?, ?, 0, FALSE)
        ''', (video_id, segment_index, len(items_created)))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'itemsCreated': len(items_created),
            'items': items_created
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/lessons/<video_id>/<int:segment_index>', methods=['GET'])
def get_lessons(video_id, segment_index):
    """Get all lesson items for a video segment"""
    try:
        conn = get_db_connection()
        
        items = conn.execute('''
            SELECT li.*, lp.attempts, lp.understood, lp.last_seen
            FROM lesson_items li
            LEFT JOIN lesson_progress lp ON li.id = lp.item_id
            WHERE li.video_id = ? AND li.segment_index = ?
            ORDER BY li.created_at
        ''', (video_id, segment_index)).fetchall()
        
        conn.close()
        
        lesson_list = []
        for item in items:
            i = dict(item)
            lesson_list.append({
                'id': i['id'],
                'videoId': i['video_id'],
                'segmentIndex': i['segment_index'],
                'originalText': i['original_text'],
                'variations': json.loads(i['variations']) if i['variations'] else [],
                'audioData': json.loads(i['audio_data']) if i['audio_data'] else [],
                'attempts': i['attempts'] or 0,
                'understood': i['understood'] or 0,
                'lastSeen': i['last_seen']
            })
        
        return jsonify(lesson_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/lessons/<item_id>/progress', methods=['POST'])
def update_lesson_progress(item_id):
    """Record user's response (understood or not)"""
    data = request.json
    understood = data.get('understood', False)
    
    try:
        conn = get_db_connection()
        
        # Update progress
        if understood:
            conn.execute('''
                UPDATE lesson_progress 
                SET attempts = attempts + 1, understood = understood + 1, last_seen = CURRENT_TIMESTAMP
                WHERE item_id = ?
            ''', (item_id,))
        else:
            conn.execute('''
                UPDATE lesson_progress 
                SET attempts = attempts + 1, last_seen = CURRENT_TIMESTAMP
                WHERE item_id = ?
            ''', (item_id,))
        
        conn.commit()
        
        # Get updated progress
        progress = conn.execute(
            'SELECT attempts, understood FROM lesson_progress WHERE item_id = ?',
            (item_id,)
        ).fetchone()
        
        conn.close()
        
        if progress:
            return jsonify({
                'status': 'success',
                'attempts': progress['attempts'],
                'understood': progress['understood'],
                'ratio': progress['understood'] / progress['attempts'] if progress['attempts'] > 0 else 0
            })
        else:
            return jsonify({'error': 'Item not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/lessons/<item_id>/variations', methods=['PUT'])
def update_lesson_variations(item_id):
    """Store AI-generated variations for a lesson item"""
    data = request.json
    variations = data.get('variations', [])
    audio_data = data.get('audioData', [])
    
    try:
        conn = get_db_connection()
        
        conn.execute('''
            UPDATE lesson_items 
            SET variations = ?, audio_data = ?
            WHERE id = ?
        ''', (json.dumps(variations), json.dumps(audio_data), item_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/segments/<video_id>', methods=['GET'])
def get_segment_progress(video_id):
    """Get progress for all segments of a video"""
    try:
        conn = get_db_connection()
        
        segments = conn.execute('''
            SELECT * FROM segment_progress WHERE video_id = ? ORDER BY segment_index
        ''', (video_id,)).fetchall()
        
        conn.close()
        
        segment_list = []
        for seg in segments:
            s = dict(seg)
            segment_list.append({
                'videoId': s['video_id'],
                'segmentIndex': s['segment_index'],
                'totalItems': s['total_items'],
                'completedItems': s['completed_items'],
                'isUnlocked': bool(s['is_unlocked']),
                'progress': s['completed_items'] / s['total_items'] if s['total_items'] > 0 else 0
            })
        
        return jsonify(segment_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Goal Videos API (Learning Section) ---

@app.route('/api/goals', methods=['GET'])
def get_goal_videos():
    """Get all goal videos for learning"""
    try:
        conn = get_db_connection()
        goals = conn.execute('''
            SELECT * FROM goal_videos ORDER BY last_studied_at DESC, created_at DESC
        ''').fetchall()
        conn.close()
        
        goal_list = []
        for g in goals:
            goal = dict(g)
            goal_list.append({
                'id': goal['id'],
                'videoId': goal['video_id'],
                'title': goal['title'],
                'thumbnail': goal['thumbnail'],
                'language': goal.get('language', 'en'),
                'durationSeconds': goal['duration_seconds'],
                'segmentDuration': goal['segment_duration'],
                'totalSegments': goal['total_segments'],
                'completedSegments': goal['completed_segments'],
                'overallProgress': goal['overall_progress'],
                'createdAt': goal['created_at'],
                'lastStudiedAt': goal['last_studied_at']
            })
        
        return jsonify(goal_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals', methods=['POST'])
def create_goal_video():
    """Add a new goal video for learning"""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_id = data.get('videoId')
    language = data.get('language', 'en')  # Default to English
    
    if not video_id:
        return jsonify({'error': 'Missing videoId'}), 400
    
    try:
        conn = get_db_connection()
        
        # Check if already exists with same language
        existing = conn.execute(
            'SELECT id FROM goal_videos WHERE video_id = ? AND language = ?', (video_id, language)
        ).fetchone()
        
        if existing:
            conn.close()
            return jsonify({'status': 'exists', 'id': existing['id']}), 200
        
        # Fetch transcript from YouTube in specified language
        ytt_api = YouTubeTranscriptApi()
        try:
            transcript_obj = ytt_api.fetch(video_id, languages=[language])
        except Exception:
            # Fallback to any available
            transcript_obj = ytt_api.fetch(video_id)
        
        transcript_data = transcript_obj.to_raw_data()
        
        # Calculate duration and segments
        if transcript_data:
            last_item = transcript_data[-1]
            duration_seconds = int(last_item['start'] + last_item['duration'])
        else:
            duration_seconds = 0
        
        segment_duration = data.get('segmentDuration', 240)  # Default 4 minutes
        
        # Calculate total segments, merging small final segments with the previous one
        # e.g., 20:28 video with 4-min segments = 5 segments (last one is 4:24 instead of 4:00 + 0:24)
        if duration_seconds <= segment_duration:
            total_segments = 1
        else:
            # Number of full segments
            full_segments = duration_seconds // segment_duration
            # The last segment will include any remaining time
            total_segments = full_segments
        
        # Get video title from oEmbed
        title = data.get('title', f'YouTube Video ({video_id})')
        
        goal_id = str(uuid.uuid4())
        
        conn.execute('''
            INSERT INTO goal_videos (id, video_id, title, thumbnail, language, duration_seconds, 
                                     segment_duration, total_segments, transcript, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            goal_id,
            video_id,
            title,
            f'https://i.ytimg.com/vi/{video_id}/mqdefault.jpg',
            language,
            duration_seconds,
            segment_duration,
            total_segments,
            json.dumps(transcript_data)
        ))
        
        # Initialize segment progress for first segment (unlocked)
        conn.execute('''
            INSERT OR REPLACE INTO segment_progress (video_id, segment_index, total_items, completed_items, is_unlocked)
            VALUES (?, 0, 0, 0, TRUE)
        ''', (goal_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'id': goal_id,
            'videoId': video_id,
            'totalSegments': total_segments,
            'durationSeconds': duration_seconds
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/<goal_id>', methods=['GET'])
def get_goal_video(goal_id):
    """Get a specific goal video with its segments"""
    try:
        conn = get_db_connection()
        
        goal = conn.execute(
            'SELECT * FROM goal_videos WHERE id = ?', (goal_id,)
        ).fetchone()
        
        if not goal:
            conn.close()
            return jsonify({'error': 'Goal not found'}), 404
        
        g = dict(goal)
        
        # Parse transcript and split into segments
        transcript = json.loads(g['transcript']) if g['transcript'] else []
        segment_duration = g['segment_duration']
        video_end_time = transcript[-1]['start'] + transcript[-1]['duration'] if transcript else 0
        
        segments = []
        current_segment = []
        segment_start = 0
        segment_index = 0
        
        for item in transcript:
            # Check if we should start a new segment
            time_elapsed = item['start'] - segment_start
            remaining_time = video_end_time - item['start']
            
            # Only split if:
            # 1. We've exceeded segment duration
            # 2. The remaining time is >= segment_duration (avoid tiny last segments)
            if time_elapsed >= segment_duration and current_segment and remaining_time >= segment_duration:
                # Get segment mastery (new system)
                mastery = conn.execute('''
                    SELECT * FROM segment_mastery WHERE goal_id = ? AND segment_index = ?
                ''', (goal_id, segment_index)).fetchone()
                
                # Check if previous segment is complete to unlock this one
                prev_complete = True
                if segment_index > 0:
                    prev_mastery = conn.execute('''
                        SELECT video_watched FROM segment_mastery WHERE goal_id = ? AND segment_index = ?
                    ''', (goal_id, segment_index - 1)).fetchone()
                    prev_complete = prev_mastery and prev_mastery['video_watched']
                
                is_unlocked = segment_index == 0 or prev_complete
                is_complete = mastery and mastery['video_watched']
                
                segments.append({
                    'index': segment_index,
                    'startTime': segment_start,
                    'endTime': item['start'],
                    'sentences': len(current_segment),
                    'preview': current_segment[0]['text'][:50] + '...' if current_segment else '',
                    'isUnlocked': is_unlocked,
                    'progress': 100 if is_complete else 0
                })
                
                current_segment = []
                segment_start = item['start']
                segment_index += 1
            
            current_segment.append(item)
        
        # Add last segment (includes any remaining short portion)
        if current_segment:
            mastery = conn.execute('''
                SELECT * FROM segment_mastery WHERE goal_id = ? AND segment_index = ?
            ''', (goal_id, segment_index)).fetchone()
            
            # Check if previous segment is complete to unlock this one
            prev_complete = True
            if segment_index > 0:
                prev_mastery = conn.execute('''
                    SELECT video_watched FROM segment_mastery WHERE goal_id = ? AND segment_index = ?
                ''', (goal_id, segment_index - 1)).fetchone()
                prev_complete = prev_mastery and prev_mastery['video_watched']
            
            is_unlocked = segment_index == 0 or prev_complete
            is_complete = mastery and mastery['video_watched']
            
            segments.append({
                'index': segment_index,
                'startTime': segment_start,
                'endTime': video_end_time,
                'sentences': len(current_segment),
                'preview': current_segment[0]['text'][:50] + '...' if current_segment else '',
                'isUnlocked': is_unlocked,
                'progress': 100 if is_complete else 0
            })
        
        conn.close()
        
        return jsonify({
            'id': g['id'],
            'videoId': g['video_id'],
            'title': g['title'],
            'thumbnail': g['thumbnail'],
            'durationSeconds': g['duration_seconds'],
            'segmentDuration': g['segment_duration'],
            'totalSegments': g['total_segments'],
            'completedSegments': g['completed_segments'],
            'overallProgress': g['overall_progress'],
            'segments': segments
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/<goal_id>', methods=['DELETE'])
def delete_goal_video(goal_id):
    """Delete a goal video and its associated data"""
    try:
        conn = get_db_connection()
        
        # Delete associated lesson items and progress
        conn.execute('DELETE FROM lesson_progress WHERE item_id IN (SELECT id FROM lesson_items WHERE video_id = ?)', (goal_id,))
        conn.execute('DELETE FROM lesson_items WHERE video_id = ?', (goal_id,))
        conn.execute('DELETE FROM segment_progress WHERE video_id = ?', (goal_id,))
        conn.execute('DELETE FROM goal_videos WHERE id = ?', (goal_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'deleted'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/<goal_id>/segment/<int:segment_index>/sentences', methods=['GET'])
def get_segment_sentences(goal_id, segment_index):
    """Get sentences for a specific segment of a goal video"""
    try:
        conn = get_db_connection()
        
        goal = conn.execute(
            'SELECT transcript, segment_duration FROM goal_videos WHERE id = ?', (goal_id,)
        ).fetchone()
        
        if not goal:
            conn.close()
            return jsonify({'error': 'Goal not found'}), 404
        
        transcript = json.loads(goal['transcript']) if goal['transcript'] else []
        segment_duration = goal['segment_duration']
        
        # Find sentences for this segment
        segment_start = segment_index * segment_duration
        segment_end = (segment_index + 1) * segment_duration
        
        sentences = [
            item['text'] for item in transcript
            if item['start'] >= segment_start and item['start'] < segment_end
        ]
        
        conn.close()
        
        return jsonify({
            'segmentIndex': segment_index,
            'sentences': sentences,
            'count': len(sentences)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Assessment API ---

@app.route('/api/assessment/profile', methods=['GET'])
def get_assessment_profile():
    """Get the user's latest assessment profile"""
    try:
        conn = get_db_connection()
        # Get the most recent profile
        profile = conn.execute('''
            SELECT * FROM assessment_profiles ORDER BY updated_at DESC LIMIT 1
        ''').fetchone()
        conn.close()
        
        if not profile:
            # Return empty structure if no profile exists
            return jsonify(None)
            
        p = dict(profile)
        return jsonify({
            'id': p['id'],
            'targetLanguage': p['target_language'],
            'targetContent': p['target_content'],
            'listeningLevel': p['listening_level'],
            'subtitleDependence': p['subtitle_dependence'],
            'difficulties': json.loads(p['difficulties']) if p['difficulties'] else [],
            'updatedAt': p['updated_at']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assessment/profile', methods=['POST'])
def save_assessment_profile():
    """Create or update assessment profile"""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    try:
        conn = get_db_connection()
        
        profile_id = str(uuid.uuid4())
        timestamp = int(data.get('completedAt', 0)) or 0
        if timestamp == 0:
             import time
             timestamp = int(time.time() * 1000)
        
        conn.execute('''
            INSERT INTO assessment_profiles 
            (id, target_language, target_content, listening_level, subtitle_dependence, difficulties, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            profile_id,
            data.get('targetLanguage', 'en'),
            data.get('targetContent', 'general'),
            data.get('listeningLevel', 2),
            data.get('subtitleDependence', 1),
            json.dumps(data.get('difficulties', [])),
            timestamp,
            timestamp
        ))
        
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'id': profile_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assessment/results', methods=['GET'])
def get_assessment_results():
    """Get recent mini-test results"""
    try:
        conn = get_db_connection()
        # Get last 5 test results
        results = conn.execute('''
            SELECT * FROM mini_test_results ORDER BY taken_at DESC LIMIT 5
        ''').fetchall()
        
        if not results:
            conn.close()
            return jsonify([])

        output_list = []
        for res in results:
            r = dict(res)
            
            details = conn.execute('''
                SELECT * FROM mini_test_details WHERE result_id = ? ORDER BY question_index
            ''', (r['id'],)).fetchall()
            
            test_responses = []
            for d in details:
                det = dict(d)
                test_responses.append({
                    'sentenceId': det['question_index'], # Mapping index to ID for frontend compat
                    'sentence': det['sentence'],
                    'understood': bool(det['understood']),
                    'replays': det['replays'],
                    'reactionTimeMs': det['reaction_time_ms'],
                    'markedIndices': json.loads(det['marked_indices']) if det['marked_indices'] else []
                })

            analysis = json.loads(r['analysis_json']) if r['analysis_json'] else None
            
            output_list.append({
                'id': r['id'],
                'takenAt': r['taken_at'],
                'score': r['score'],
                'totalQuestions': r['total_questions'],
                'analysis': analysis,
                'responses': test_responses
            })
            
        conn.close()
        return jsonify(output_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assessment/results', methods=['POST'])
def save_assessment_result():
    """Save a full test result with details"""
    data = request.json
    if not data:
         return jsonify({'error': 'No data provided'}), 400

    # Data expected: { responses: [...], analysis: {...} }
    responses = data.get('responses', [])
    analysis = data.get('analysis', {})
    
    if not responses:
        return jsonify({'error': 'No responses provided'}), 400
        
    try:
        conn = get_db_connection()
        
        result_id = str(uuid.uuid4())
        import time
        taken_at = int(time.time() * 1000)
        
        # Calculate stats
        total_questions = len(responses)
        score = sum(1 for r in responses if r.get('understood', False))
        
        conn.execute('''
            INSERT INTO mini_test_results 
            (id, taken_at, score, total_questions, analysis_json)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            result_id,
            taken_at,
            score,
            total_questions,
            json.dumps(analysis)
        ))
        
        # Insert details
        for i, resp in enumerate(responses):
            conn.execute('''
                INSERT INTO mini_test_details
                (id, result_id, question_index, sentence, understood, replays, reaction_time_ms, marked_indices)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()),
                result_id,
                i, # Use index as order
                resp.get('sentence', ''),
                resp.get('understood', False),
                resp.get('replays', 0),
                resp.get('reactionTimeMs', 0),
                json.dumps(resp.get('markedIndices', [])) # Frontend sends 'markedIndices'
            ))
            
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'id': result_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Segment Learning API (Test-Learn-Watch Flow) ---

@app.route('/api/segment-learning/<goal_id>/<int:segment_index>/mastery', methods=['GET'])
def get_segment_mastery(goal_id, segment_index):
    """Get mastery status for a segment"""
    try:
        conn = get_db_connection()
        
        mastery = conn.execute('''
            SELECT * FROM segment_mastery WHERE goal_id = ? AND segment_index = ?
        ''', (goal_id, segment_index)).fetchone()
        
        conn.close()
        
        if mastery:
            return jsonify({
                'testAttempts': mastery['test_attempts'],
                'bestAccuracy': mastery['best_accuracy'],
                'isMastered': bool(mastery['is_mastered']),
                'videoWatched': bool(mastery['video_watched']),
                'lastTestAt': mastery['last_test_at']
            })
        else:
            return jsonify({
                'testAttempts': 0,
                'bestAccuracy': 0.0,
                'isMastered': False,
                'videoWatched': False,
                'lastTestAt': None
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/segment-learning/<goal_id>/<int:segment_index>/test', methods=['POST'])
def save_segment_test(goal_id, segment_index):
    """Save a segment test result with AI-generated sentences and user responses"""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    sentences = data.get('sentences', [])  # AI-generated test sentences
    responses = data.get('responses', [])  # User behavior data
    analysis = data.get('analysis', {})    # AI feedback
    
    if not sentences or not responses:
        return jsonify({'error': 'Missing sentences or responses'}), 400
    
    try:
        conn = get_db_connection()
        import time
        taken_at = int(time.time() * 1000)
        
        # Get current attempt number
        existing = conn.execute('''
            SELECT MAX(attempt_number) as max_attempt FROM segment_tests 
            WHERE goal_id = ? AND segment_index = ?
        ''', (goal_id, segment_index)).fetchone()
        
        attempt_number = (existing['max_attempt'] or 0) + 1
        
        # Calculate score
        total_questions = len(responses)
        score = sum(1 for r in responses if r.get('understood', False))
        accuracy = score / total_questions if total_questions > 0 else 0.0
        
        test_id = str(uuid.uuid4())
        
        # Save test
        conn.execute('''
            INSERT INTO segment_tests 
            (id, goal_id, segment_index, attempt_number, sentences_json, taken_at, score, total_questions, accuracy, analysis_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            test_id,
            goal_id,
            segment_index,
            attempt_number,
            json.dumps(sentences),
            taken_at,
            score,
            total_questions,
            accuracy,
            json.dumps(analysis)
        ))
        
        # Save test details (user behavior)
        for i, resp in enumerate(responses):
            conn.execute('''
                INSERT INTO segment_test_details
                (id, test_id, question_index, sentence, understood, replays, reaction_time_ms, marked_indices)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()),
                test_id,
                i,
                resp.get('sentence', ''),
                resp.get('understood', False),
                resp.get('replays', 0),
                resp.get('reactionTimeMs', 0),
                json.dumps(resp.get('markedIndices', []))
            ))
        
        # Update mastery record
        conn.execute('''
            INSERT INTO segment_mastery (goal_id, segment_index, test_attempts, best_accuracy, is_mastered, last_test_at)
            VALUES (?, ?, 1, ?, ?, ?)
            ON CONFLICT(goal_id, segment_index) DO UPDATE SET
                test_attempts = test_attempts + 1,
                best_accuracy = MAX(best_accuracy, excluded.best_accuracy),
                is_mastered = CASE WHEN excluded.best_accuracy >= 0.8 THEN TRUE ELSE is_mastered END,
                last_test_at = excluded.last_test_at
        ''', (goal_id, segment_index, accuracy, accuracy >= 0.8, taken_at))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'testId': test_id,
            'attemptNumber': attempt_number,
            'score': score,
            'accuracy': accuracy,
            'isMastered': accuracy >= 0.8
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/segment-learning/<goal_id>/<int:segment_index>/tests', methods=['GET'])
def get_segment_tests(goal_id, segment_index):
    """Get all test attempts for a segment"""
    try:
        conn = get_db_connection()
        
        tests = conn.execute('''
            SELECT * FROM segment_tests 
            WHERE goal_id = ? AND segment_index = ?
            ORDER BY attempt_number DESC
        ''', (goal_id, segment_index)).fetchall()
        
        result = []
        for test in tests:
            t = dict(test)
            
            # Get details for this test
            details = conn.execute('''
                SELECT * FROM segment_test_details WHERE test_id = ? ORDER BY question_index
            ''', (t['id'],)).fetchall()
            
            test_responses = []
            for d in details:
                det = dict(d)
                test_responses.append({
                    'sentence': det['sentence'],
                    'understood': bool(det['understood']),
                    'replays': det['replays'],
                    'reactionTimeMs': det['reaction_time_ms'],
                    'markedIndices': json.loads(det['marked_indices']) if det['marked_indices'] else []
                })
            
            result.append({
                'id': t['id'],
                'attemptNumber': t['attempt_number'],
                'takenAt': t['taken_at'],
                'score': t['score'],
                'totalQuestions': t['total_questions'],
                'accuracy': t['accuracy'],
                'sentences': json.loads(t['sentences_json']) if t['sentences_json'] else [],
                'analysis': json.loads(t['analysis_json']) if t['analysis_json'] else None,
                'responses': test_responses
            })
        
        conn.close()
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/segment-learning/<goal_id>/<int:segment_index>/lessons', methods=['POST'])
def save_segment_lessons(goal_id, segment_index):
    """Save AI-generated lessons based on test mistakes"""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    test_id = data.get('testId')
    lessons = data.get('lessons', [])  # Array of lesson objects
    
    if not lessons:
        return jsonify({'error': 'No lessons provided'}), 400
    
    try:
        conn = get_db_connection()
        import time
        created_at = int(time.time() * 1000)
        
        lesson_ids = []
        for lesson in lessons:
            lesson_id = str(uuid.uuid4())
            conn.execute('''
                INSERT INTO segment_lessons 
                (id, goal_id, segment_index, test_id, lesson_type, content_json, created_at, completed)
                VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)
            ''', (
                lesson_id,
                goal_id,
                segment_index,
                test_id,
                lesson.get('type', 'general'),
                json.dumps(lesson.get('content', {})),
                created_at
            ))
            lesson_ids.append(lesson_id)
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'lessonIds': lesson_ids,
            'count': len(lesson_ids)
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/segment-learning/<goal_id>/<int:segment_index>/lessons', methods=['GET'])
def get_segment_lessons(goal_id, segment_index):
    """Get all lessons for a segment"""
    try:
        conn = get_db_connection()
        
        lessons = conn.execute('''
            SELECT * FROM segment_lessons 
            WHERE goal_id = ? AND segment_index = ?
            ORDER BY created_at DESC
        ''', (goal_id, segment_index)).fetchall()
        
        result = []
        for lesson in lessons:
            l = dict(lesson)
            result.append({
                'id': l['id'],
                'testId': l['test_id'],
                'type': l['lesson_type'],
                'content': json.loads(l['content_json']) if l['content_json'] else {},
                'createdAt': l['created_at'],
                'completed': bool(l['completed'])
            })
        
        conn.close()
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/segment-learning/<goal_id>/<int:segment_index>/lessons/<lesson_id>/complete', methods=['POST'])
def complete_segment_lesson(goal_id, segment_index, lesson_id):
    """Mark a lesson as completed"""
    try:
        conn = get_db_connection()
        
        conn.execute('''
            UPDATE segment_lessons SET completed = TRUE WHERE id = ?
        ''', (lesson_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/segment-learning/<goal_id>/<int:segment_index>/watch', methods=['POST'])
def mark_segment_watched(goal_id, segment_index):
    """Mark a segment as watched (video completed)"""
    try:
        conn = get_db_connection()
        import time
        
        conn.execute('''
            INSERT INTO segment_mastery (goal_id, segment_index, video_watched)
            VALUES (?, ?, TRUE)
            ON CONFLICT(goal_id, segment_index) DO UPDATE SET video_watched = TRUE
        ''', (goal_id, segment_index))
        
        # Update overall progress in goal_videos
        mastery_records = conn.execute('''
            SELECT COUNT(*) as watched FROM segment_mastery 
            WHERE goal_id = ? AND video_watched = TRUE
        ''', (goal_id,)).fetchone()
        
        goal = conn.execute('''
            SELECT total_segments FROM goal_videos WHERE id = ?
        ''', (goal_id,)).fetchone()
        
        if goal and goal['total_segments'] > 0:
            progress = mastery_records['watched'] / goal['total_segments']
            conn.execute('''
                UPDATE goal_videos SET 
                    overall_progress = ?,
                    completed_segments = ?,
                    last_studied_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (progress, mastery_records['watched'], goal_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # init_db() # Run here too to be safe
    port = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=port, debug=True)



