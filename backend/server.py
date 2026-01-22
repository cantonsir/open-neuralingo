import sqlite3
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi

app = Flask(__name__)
CORS(app)

DB_FILE = 'flashcards.db'

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
    conn.commit()
    conn.close()

# Initialize DB on start
if not os.path.exists(DB_FILE):
    init_db()
else:
    # Ensure table exists even if file exists (e.g. empty file)
    init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/transcript', methods=['GET'])
def get_transcript():
    video_id = request.args.get('videoId')
    if not video_id:
        return jsonify({'error': 'Missing videoId parameter'}), 400

    try:
        # Initializing the API client (required for this version of the library)
        api = YouTubeTranscriptApi()
        
        # Fetch returns a FetchedTranscript object
        transcript_obj = api.fetch(video_id)
        
        # Convert to list of dicts using the method provided by the library
        transcript_data = transcript_obj.to_raw_data()
        
        return jsonify(transcript_data)
    except Exception as e:
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

if __name__ == '__main__':
    # init_db() # Run here too to be safe
    app.run(host='0.0.0.0', port=5000, debug=True)
