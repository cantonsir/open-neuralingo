"""
Speaking Routes

Handles speaking session history and conversation storage.
"""

import json
import uuid
from flask import Blueprint, request, jsonify

from app.database import get_db_connection


speaking_bp = Blueprint('speaking', __name__)


@speaking_bp.route('/speaking/sessions', methods=['GET'])
def get_speaking_sessions():
    """
    Get all speaking sessions.
    
    Returns:
        Array of speaking session objects
    """
    try:
        conn = get_db_connection()
        sessions = conn.execute('''
            SELECT * FROM speaking_sessions 
            ORDER BY created_at DESC
        ''').fetchall()
        conn.close()
        
        session_list = []
        for s in sessions:
            sess = dict(s)
            session_list.append({
                'id': sess['id'],
                'topic': sess['topic'],
                'transcript': json.loads(sess['transcript_json']) if sess['transcript_json'] else [],
                'durationSeconds': sess['duration_seconds'],
                'createdAt': sess['created_at']
            })
        
        return jsonify(session_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@speaking_bp.route('/speaking/sessions', methods=['POST'])
def save_speaking_session():
    """
    Save a speaking session.
    
    Request Body:
        topic: Session topic
        transcript: Array of {role, text} objects
        durationSeconds: Session duration
        createdAt: Timestamp
    
    Returns:
        Created session ID
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        conn = get_db_connection()
        session_id = str(uuid.uuid4())
        
        conn.execute('''
            INSERT INTO speaking_sessions 
            (id, topic, transcript_json, duration_seconds, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            session_id,
            data.get('topic', 'Untitled Session'),
            json.dumps(data.get('transcript', [])),
            data.get('durationSeconds', 0),
            data.get('createdAt', 0)
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success', 'id': session_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
