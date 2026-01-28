"""
Listening Routes

Handles listening session CRUD operations and audio generation.
"""

import time
import uuid
import json
from flask import Blueprint, request, jsonify

from app.database import get_db


listening_bp = Blueprint('listening', __name__)


@listening_bp.route('/listening/sessions', methods=['GET'])
def get_listening_sessions():
    """
    Get all listening sessions.
    
    Returns:
        Array of listening session objects
    """
    try:
        with get_db() as conn:
            sessions = conn.execute('''
                SELECT * FROM listening_sessions 
                ORDER BY created_at DESC
            ''').fetchall()
            
            session_list = []
            for s in sessions:
                sess = dict(s)
                # Parse transcript JSON
                transcript = []
                if sess['transcript_json']:
                    try:
                        transcript = json.loads(sess['transcript_json'])
                    except:
                        transcript = []
                
                session_list.append({
                    'id': sess['id'],
                    'prompt': sess['prompt'],
                    'audioUrl': sess['audio_url'],
                    'transcript': transcript,
                    'durationSeconds': sess['duration_seconds'],
                    'contextId': sess['context_id'],
                    'createdAt': sess['created_at']
                })
            
            return jsonify(session_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@listening_bp.route('/listening/sessions', methods=['POST'])
def save_listening_session():
    """
    Save a listening session.
    
    Request Body:
        prompt: User's input prompt
        audioUrl: Path to generated audio file
        transcript: Array of conversation lines
        durationSeconds: Audio duration in seconds
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
            
            # Serialize transcript to JSON
            transcript_json = json.dumps(data.get('transcript', []))
            
            conn.execute('''
                INSERT INTO listening_sessions 
                (id, prompt, audio_url, transcript_json, duration_seconds, context_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                data.get('prompt', 'Untitled'),
                data.get('audioUrl', ''),
                transcript_json,
                data.get('durationSeconds', 0),
                data.get('contextId'),
                data.get('createdAt', int(time.time() * 1000))
            ))
            
            conn.commit()
            
            return jsonify({'status': 'success', 'id': session_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@listening_bp.route('/listening/feedback', methods=['GET'])
def get_listening_feedback_sessions():
    """
    Get all listening feedback sessions.

    Returns:
        Array of feedback session objects
    """
    try:
        with get_db() as conn:
            sessions = conn.execute('''
                SELECT * FROM listening_feedback_sessions
                ORDER BY created_at DESC
            ''').fetchall()

            session_list = []
            for s in sessions:
                sess = dict(s)

                markers = []
                if sess.get('marker_snapshot_json'):
                    try:
                        markers = json.loads(sess['marker_snapshot_json'])
                    except:
                        markers = []

                feedback = None
                if sess.get('feedback_json'):
                    try:
                        feedback = json.loads(sess['feedback_json'])
                    except:
                        feedback = None

                session_list.append({
                    'id': sess['id'],
                    'videoId': sess.get('video_id'),
                    'videoTitle': sess.get('video_title'),
                    'markers': markers,
                    'feedback': feedback,
                    'contextId': sess.get('context_id'),
                    'createdAt': sess.get('created_at')
                })

            return jsonify(session_list)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@listening_bp.route('/listening/feedback', methods=['POST'])
def save_listening_feedback_session():
    """
    Save a listening feedback session.

    Request Body:
        videoId: YouTube video id
        videoTitle: Video title
        markers: Array of marker objects (snapshot)
        feedback: Optional AI feedback
        contextId: Optional context id
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
            marker_json = json.dumps(data.get('markers', []))
            feedback_payload = data.get('feedback')
            feedback_json = json.dumps(feedback_payload) if feedback_payload is not None else None

            conn.execute('''
                INSERT INTO listening_feedback_sessions
                (id, video_id, video_title, marker_snapshot_json, feedback_json, context_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                data.get('videoId', ''),
                data.get('videoTitle', ''),
                marker_json,
                feedback_json,
                data.get('contextId'),
                data.get('createdAt', int(time.time() * 1000))
            ))

            conn.commit()

            return jsonify({'status': 'success', 'id': session_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500
