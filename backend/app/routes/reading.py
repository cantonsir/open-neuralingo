"""
Reading Routes

Handles reading session CRUD operations.
"""

import time
import uuid
from flask import Blueprint, request, jsonify

from app.database import get_db


reading_bp = Blueprint('reading', __name__)


@reading_bp.route('/reading/sessions', methods=['GET'])
def get_reading_sessions():
    """
    Get all reading sessions.
    
    Returns:
        Array of reading session objects
    """
    try:
        with get_db() as conn:
            sessions = conn.execute('''
                SELECT * FROM reading_sessions 
                ORDER BY created_at DESC
            ''').fetchall()
            
            session_list = []
            for s in sessions:
                sess = dict(s)
                session_list.append({
                    'id': sess['id'],
                    'prompt': sess['prompt'],
                    'title': sess['title'],
                    'content': sess['content'],
                    'contextId': sess['context_id'],
                    'createdAt': sess['created_at']
                })
            
            return jsonify(session_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reading_bp.route('/reading/sessions', methods=['POST'])
def save_reading_session():
    """
    Save a reading session.
    
    Request Body:
        prompt: User's input prompt
        title: Generated title
        content: Generated reading material
        contextId: Optional context ID
        createdAt: Creation timestamp
    
    Returns:
        Created session ID
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    try:
        with get_db() as conn:
            session_id = str(uuid.uuid4())
            
            conn.execute('''
                INSERT INTO reading_sessions 
                (id, prompt, title, content, context_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                data.get('prompt', 'Untitled'),
                data.get('title', 'Untitled'),
                data.get('content', ''),
                data.get('contextId'),
                data.get('createdAt', int(time.time() * 1000))
            ))
            
            conn.commit()
            
            return jsonify({'status': 'success', 'id': session_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
