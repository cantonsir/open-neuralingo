"""
Flashcards Routes

Handles CRUD operations for flashcards/markers.
"""

import json
from flask import Blueprint, request, jsonify

from app.database import get_db_connection


flashcards_bp = Blueprint('flashcards', __name__)


def _parse_json_field(value, default):
    """Safely parse a JSON field with a default fallback."""
    if not value:
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def _card_to_marker(card: dict) -> dict:
    """Convert a database card record to frontend Marker format."""
    return {
        'id': card['id'],
        'videoId': card['video_id'],
        'start': card['start_time'],
        'end': card['end_time'],
        'subtitleText': card['subtitle_text'],
        'createdAt': card['created_at'],
        'vocabData': _parse_json_field(card['vocab_data'], {}),
        'misunderstoodIndices': _parse_json_field(card['misunderstood_indices'], []),
        'tags': _parse_json_field(card['tags'], []),
        'note': card['note'],
        'press_count': card['press_count']
    }


@flashcards_bp.route('/cards', methods=['GET'])
def get_cards():
    """
    Get all flashcards.
    
    Returns:
        JSON array of all flashcard markers
    """
    try:
        conn = get_db_connection()
        cards = conn.execute(
            'SELECT * FROM flashcards ORDER BY created_at DESC'
        ).fetchall()
        conn.close()
        
        return jsonify([_card_to_marker(dict(card)) for card in cards])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/cards', methods=['POST'])
def save_card():
    """
    Save a new flashcard or update existing one.
    
    Request Body:
        id, start, end, subtitleText, createdAt, vocabData, 
        misunderstoodIndices, tags, note, pressCount, videoId
    
    Returns:
        Success status with card ID
    """
    card = request.json
    if not card:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        conn = get_db_connection()
        conn.execute('''
            INSERT OR REPLACE INTO flashcards 
            (id, video_id, start_time, end_time, subtitle_text, created_at, 
             vocab_data, misunderstood_indices, tags, note, press_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            card['id'],
            card.get('videoId', ''),
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


@flashcards_bp.route('/cards/<card_id>', methods=['DELETE'])
def delete_card(card_id):
    """
    Delete a flashcard by ID.
    
    Path Parameters:
        card_id: Flashcard ID to delete
    
    Returns:
        Deletion status
    """
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM flashcards WHERE id = ?', (card_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'deleted'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/cards/<card_id>', methods=['PUT'])
def update_card(card_id):
    """
    Update specific fields of a flashcard.
    
    Path Parameters:
        card_id: Flashcard ID to update
    
    Request Body:
        Partial update with any of: vocabData, note, pressCount, misunderstoodIndices
    
    Returns:
        Update status
    """
    updates = request.json
    if not updates:
        return jsonify({'error': 'No data provided'}), 400

    try:
        conn = get_db_connection()
        
        # Build dynamic update query
        fields = []
        values = []
        
        field_mapping = {
            'vocabData': ('vocab_data', lambda v: json.dumps(v)),
            'note': ('note', lambda v: v),
            'pressCount': ('press_count', lambda v: v),
            'misunderstoodIndices': ('misunderstood_indices', lambda v: json.dumps(v))
        }
        
        for key, (db_field, transform) in field_mapping.items():
            if key in updates:
                fields.append(f'{db_field} = ?')
                values.append(transform(updates[key]))
        
        if not fields:
            return jsonify({'status': 'no changes'}), 200

        values.append(card_id)
        query = f'UPDATE flashcards SET {", ".join(fields)} WHERE id = ?'
        
        conn.execute(query, values)
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'updated'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
