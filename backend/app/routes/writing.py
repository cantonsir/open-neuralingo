"""
Writing Routes

Handles writing session CRUD operations.
"""

import time
import uuid
from flask import Blueprint, request, jsonify

from app.database import get_db


writing_bp = Blueprint('writing', __name__)


@writing_bp.route('/writing/sessions', methods=['GET'])
def get_writing_sessions():
    """
    Get all writing sessions.
    
    Returns:
        Array of writing session objects
    """
    try:
        with get_db() as conn:
            sessions = conn.execute('''
                SELECT * FROM writing_sessions 
                ORDER BY updated_at DESC
            ''').fetchall()
            
            session_list = []
            for s in sessions:
                sess = dict(s)
                session_list.append({
                    'id': sess['id'],
                    'topic': sess['topic'],
                    'content': sess['content'],
                    'contextId': sess['context_id'],
                    'createdAt': sess['created_at'],
                    'updatedAt': sess['updated_at']
                })
            
            return jsonify(session_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@writing_bp.route('/writing/sessions', methods=['POST'])
def save_writing_session():
    """
    Save a writing session.
    
    Request Body:
        id: Optional session ID (for updates)
        topic: Session topic
        content: Written content
        contextId: Related context ID
        createdAt: Creation timestamp
    
    Returns:
        Created/updated session ID
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    try:
        with get_db() as conn:
            session_id = data.get('id') or str(uuid.uuid4())
            
            conn.execute('''
                INSERT OR REPLACE INTO writing_sessions 
                (id, topic, content, context_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                data.get('topic', 'Untitled'),
                data.get('content', ''),
                data.get('contextId'),
                data.get('createdAt', int(time.time() * 1000)),
                int(time.time() * 1000)
            ))
            
            conn.commit()
            
            return jsonify({'status': 'success', 'id': session_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
