"""
Watch History Routes

Handles CRUD operations for video watch history.
"""

from flask import Blueprint, request, jsonify

from app.database import get_db


history_bp = Blueprint('history', __name__)


def _history_to_dict(item: dict) -> dict:
    """Convert a database history record to frontend format."""
    return {
        'videoId': item['video_id'],
        'title': item['title'],
        'thumbnail': item['thumbnail'],
        'watchedAt': item['watched_at'],
        'duration': item['duration'],
        'wordsLearned': item['words_learned']
    }


@history_bp.route('/history', methods=['GET'])
def get_history():
    """
    Get all watch history items.
    
    Returns:
        JSON array of watch history items sorted by watched_at descending
    """
    try:
        with get_db() as conn:
            items = conn.execute(
                'SELECT * FROM watch_history ORDER BY watched_at DESC'
            ).fetchall()
            
            return jsonify([_history_to_dict(dict(item)) for item in items])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@history_bp.route('/history', methods=['POST'])
def save_history():
    """
    Save a watch history item.
    
    Request Body:
        videoId, title, thumbnail, watchedAt, duration, wordsLearned
    
    Returns:
        Success status
    """
    item = request.json
    if not item:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        with get_db() as conn:
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
            
            return jsonify({'status': 'success'}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@history_bp.route('/history/<video_id>', methods=['DELETE'])
def delete_history_item(video_id):
    """
    Delete a specific watch history item.
    
    Path Parameters:
        video_id: YouTube video ID to delete from history
    
    Returns:
        Deletion status
    """
    try:
        with get_db() as conn:
            conn.execute('DELETE FROM watch_history WHERE video_id = ?', (video_id,))
            conn.commit()
            
            return jsonify({'status': 'deleted'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@history_bp.route('/history', methods=['DELETE'])
def clear_history():
    """
    Clear all watch history.
    
    Returns:
        Clear status
    """
    try:
        with get_db() as conn:
            conn.execute('DELETE FROM watch_history')
            conn.commit()
            
            return jsonify({'status': 'cleared'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
