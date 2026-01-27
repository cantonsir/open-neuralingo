"""
Lessons Routes

Handles lesson generation and progress tracking for learning sessions.
"""

import json
import uuid
from flask import Blueprint, request, jsonify

from app.database import get_db_connection


lessons_bp = Blueprint('lessons', __name__)


@lessons_bp.route('/lessons/generate', methods=['POST'])
def generate_lessons():
    """
    Generate lesson items from video transcript segment.
    
    Request Body:
        videoId: YouTube video ID
        segmentIndex: Segment number
        transcriptText: List of sentences or single string
        userLevel: beginner/intermediate/advanced
    
    Returns:
        Created lesson items with their IDs
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_id = data.get('videoId')
    segment_index = data.get('segmentIndex', 0)
    transcript_text = data.get('transcriptText', '')
    
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
            return jsonify({
                'status': 'exists',
                'message': 'Lessons already generated for this segment'
            }), 200
        
        # Parse transcript
        sentences = transcript_text if isinstance(transcript_text, list) else [transcript_text]
        
        items_created = []
        for sentence in sentences:
            if not sentence.strip():
                continue
                
            item_id = str(uuid.uuid4())
            
            conn.execute('''
                INSERT INTO lesson_items 
                (id, video_id, segment_index, original_text, variations, audio_data)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                item_id,
                video_id,
                segment_index,
                sentence.strip(),
                json.dumps([]),
                json.dumps([])
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
            INSERT OR REPLACE INTO segment_progress 
            (video_id, segment_index, total_items, completed_items, is_unlocked)
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


@lessons_bp.route('/lessons/<video_id>/<int:segment_index>', methods=['GET'])
def get_lessons(video_id, segment_index):
    """
    Get all lesson items for a video segment.
    
    Path Parameters:
        video_id: YouTube video ID or goal ID
        segment_index: Segment number
    
    Returns:
        JSON array of lesson items with progress
    """
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


@lessons_bp.route('/lessons/<item_id>/progress', methods=['POST'])
def update_lesson_progress(item_id):
    """
    Record user's response for a lesson item.
    
    Path Parameters:
        item_id: Lesson item ID
    
    Request Body:
        understood: Boolean indicating if user understood
    
    Returns:
        Updated progress statistics
    """
    data = request.json
    understood = data.get('understood', False)
    
    try:
        conn = get_db_connection()
        
        if understood:
            conn.execute('''
                UPDATE lesson_progress 
                SET attempts = attempts + 1, 
                    understood = understood + 1, 
                    last_seen = CURRENT_TIMESTAMP
                WHERE item_id = ?
            ''', (item_id,))
        else:
            conn.execute('''
                UPDATE lesson_progress 
                SET attempts = attempts + 1, 
                    last_seen = CURRENT_TIMESTAMP
                WHERE item_id = ?
            ''', (item_id,))
        
        conn.commit()
        
        progress = conn.execute(
            'SELECT attempts, understood FROM lesson_progress WHERE item_id = ?',
            (item_id,)
        ).fetchone()
        
        conn.close()
        
        if progress:
            ratio = progress['understood'] / progress['attempts'] if progress['attempts'] > 0 else 0
            return jsonify({
                'status': 'success',
                'attempts': progress['attempts'],
                'understood': progress['understood'],
                'ratio': ratio
            })
        else:
            return jsonify({'error': 'Item not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lessons_bp.route('/lessons/<item_id>/variations', methods=['PUT'])
def update_lesson_variations(item_id):
    """
    Store AI-generated variations for a lesson item.
    
    Path Parameters:
        item_id: Lesson item ID
    
    Request Body:
        variations: Array of variation strings
        audioData: Array of audio data
    
    Returns:
        Success status
    """
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


@lessons_bp.route('/segments/<video_id>', methods=['GET'])
def get_segment_progress(video_id):
    """
    Get progress for all segments of a video.
    
    Path Parameters:
        video_id: YouTube video ID or goal ID
    
    Returns:
        JSON array of segment progress objects
    """
    try:
        conn = get_db_connection()
        
        segments = conn.execute('''
            SELECT * FROM segment_progress 
            WHERE video_id = ? 
            ORDER BY segment_index
        ''', (video_id,)).fetchall()
        
        conn.close()
        
        segment_list = []
        for seg in segments:
            s = dict(seg)
            progress = s['completed_items'] / s['total_items'] if s['total_items'] > 0 else 0
            segment_list.append({
                'videoId': s['video_id'],
                'segmentIndex': s['segment_index'],
                'totalItems': s['total_items'],
                'completedItems': s['completed_items'],
                'isUnlocked': bool(s['is_unlocked']),
                'progress': progress
            })
        
        return jsonify(segment_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
