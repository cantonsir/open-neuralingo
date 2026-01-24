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
        total_segments = max(1, (duration_seconds + segment_duration - 1) // segment_duration)
        
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
        
        segments = []
        current_segment = []
        segment_start = 0
        segment_index = 0
        
        for item in transcript:
            if item['start'] - segment_start >= segment_duration and current_segment:
                # Get segment progress
                progress = conn.execute('''
                    SELECT * FROM segment_progress WHERE video_id = ? AND segment_index = ?
                ''', (goal_id, segment_index)).fetchone()
                
                segments.append({
                    'index': segment_index,
                    'startTime': segment_start,
                    'endTime': item['start'],
                    'sentences': len(current_segment),
                    'preview': current_segment[0]['text'][:50] + '...' if current_segment else '',
                    'isUnlocked': bool(progress['is_unlocked']) if progress else segment_index == 0,
                    'progress': (progress['completed_items'] / progress['total_items'] * 100) if progress and progress['total_items'] > 0 else 0
                })
                
                current_segment = []
                segment_start = item['start']
                segment_index += 1
            
            current_segment.append(item)
        
        # Add last segment
        if current_segment:
            progress = conn.execute('''
                SELECT * FROM segment_progress WHERE video_id = ? AND segment_index = ?
            ''', (goal_id, segment_index)).fetchone()
            
            segments.append({
                'index': segment_index,
                'startTime': segment_start,
                'endTime': transcript[-1]['start'] + transcript[-1]['duration'] if transcript else 0,
                'sentences': len(current_segment),
                'preview': current_segment[0]['text'][:50] + '...' if current_segment else '',
                'isUnlocked': bool(progress['is_unlocked']) if progress else segment_index == 0,
                'progress': (progress['completed_items'] / progress['total_items'] * 100) if progress and progress['total_items'] > 0 else 0
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

if __name__ == '__main__':
    # init_db() # Run here too to be safe
    app.run(host='0.0.0.0', port=5000, debug=True)



