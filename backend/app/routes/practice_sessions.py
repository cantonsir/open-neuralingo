"""
Practice Sessions Routes

Handles CRUD operations for AI-generated practice dialogues in segment learning.
Also provides video context extraction for YouTube URLs.
"""

import json
import time
import uuid
import re
import urllib.request
import urllib.parse
from flask import Blueprint, request, jsonify

from app.database import get_db

# Try to import youtube_transcript_api
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    YOUTUBE_TRANSCRIPT_AVAILABLE = True
except ImportError:
    YOUTUBE_TRANSCRIPT_AVAILABLE = False


practice_sessions_bp = Blueprint('practice_sessions', __name__)


@practice_sessions_bp.route('/practice-sessions/<goal_id>/<int:segment_index>', methods=['POST'])
def save_practice_session(goal_id, segment_index):
    """
    Save a new practice session.

    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number

    Request Body:
        prompt: User's generation prompt
        modelUsed: Model used for generation ('gemini-2.5-flash' or 'gemini-3-flash')
        transcriptJson: Array of {speaker, text} objects
        attachedContexts: (optional) Array of context sources
        audioUrls: (optional) Array of audio blob URLs
        durationSeconds: (optional) Total audio duration
        commandUsed: (optional) Command used ('plan', 'fast', or null)

    Returns:
        Created session ID
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    prompt = data.get('prompt')
    model_used = data.get('modelUsed')
    transcript_json = data.get('transcriptJson')

    if not prompt or not model_used or not transcript_json:
        return jsonify({'error': 'Missing required fields: prompt, modelUsed, transcriptJson'}), 400

    try:
        with get_db() as conn:
            session_id = str(uuid.uuid4())
            created_at = int(time.time() * 1000)

            conn.execute('''
                INSERT INTO practice_sessions
                (id, goal_id, segment_index, prompt, model_used, attached_contexts,
                 transcript_json, audio_urls, subtitles_json, duration_seconds, command_used, created_at, is_favorite)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
            ''', (
                session_id,
                goal_id,
                segment_index,
                prompt,
                model_used,
                json.dumps(data.get('attachedContexts')) if data.get('attachedContexts') else None,
                json.dumps(transcript_json),
                json.dumps(data.get('audioUrls')) if data.get('audioUrls') else None,
                json.dumps(data.get('subtitles')) if data.get('subtitles') else None,
                data.get('durationSeconds'),
                data.get('commandUsed'),
                created_at
            ))

            conn.commit()

            return jsonify({
                'status': 'success',
                'sessionId': session_id
            }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@practice_sessions_bp.route('/practice-sessions/<goal_id>/<int:segment_index>', methods=['GET'])
def get_practice_sessions(goal_id, segment_index):
    """
    Get all practice sessions for a segment.

    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number

    Returns:
        Array of practice session objects
    """
    try:
        with get_db() as conn:
            sessions = conn.execute('''
                SELECT * FROM practice_sessions
                WHERE goal_id = ? AND segment_index = ?
                ORDER BY created_at DESC
            ''', (goal_id, segment_index)).fetchall()

            result = []
            for session in sessions:
                s = dict(session)
                result.append({
                    'id': s['id'],
                    'goalId': s['goal_id'],
                    'segmentIndex': s['segment_index'],
                    'prompt': s['prompt'],
                    'modelUsed': s['model_used'],
                    'attachedContexts': json.loads(s['attached_contexts']) if s['attached_contexts'] else None,
                    'transcript': json.loads(s['transcript_json']) if s['transcript_json'] else [],
                    'audioUrls': json.loads(s['audio_urls']) if s['audio_urls'] else None,
                    'subtitles': json.loads(s['subtitles_json']) if s.get('subtitles_json') else None,
                    'durationSeconds': s['duration_seconds'],
                    'commandUsed': s['command_used'],
                    'createdAt': s['created_at'],
                    'isFavorite': bool(s['is_favorite'])
                })

            return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@practice_sessions_bp.route('/practice-sessions/<session_id>', methods=['GET'])
def get_practice_session(session_id):
    """
    Get a specific practice session by ID.

    Path Parameters:
        session_id: Practice session ID

    Returns:
        Practice session object
    """
    try:
        with get_db() as conn:
            session = conn.execute('''
                SELECT * FROM practice_sessions WHERE id = ?
            ''', (session_id,)).fetchone()

            if not session:
                return jsonify({'error': 'Session not found'}), 404

            s = dict(session)
            return jsonify({
                'id': s['id'],
                'goalId': s['goal_id'],
                'segmentIndex': s['segment_index'],
                'prompt': s['prompt'],
                'modelUsed': s['model_used'],
                'attachedContexts': json.loads(s['attached_contexts']) if s['attached_contexts'] else None,
                'transcript': json.loads(s['transcript_json']) if s['transcript_json'] else [],
                'audioUrls': json.loads(s['audio_urls']) if s['audio_urls'] else None,
                'subtitles': json.loads(s['subtitles_json']) if s.get('subtitles_json') else None,
                'durationSeconds': s['duration_seconds'],
                'commandUsed': s['command_used'],
                'createdAt': s['created_at'],
                'isFavorite': bool(s['is_favorite'])
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@practice_sessions_bp.route('/practice-sessions/<session_id>/favorite', methods=['PUT'])
def toggle_practice_favorite(session_id):
    """
    Toggle favorite status of a practice session.

    Path Parameters:
        session_id: Practice session ID

    Returns:
        Updated favorite status
    """
    try:
        with get_db() as conn:
            # Get current status
            session = conn.execute('''
                SELECT is_favorite FROM practice_sessions WHERE id = ?
            ''', (session_id,)).fetchone()

            if not session:
                return jsonify({'error': 'Session not found'}), 404

            new_status = not bool(session['is_favorite'])

            conn.execute('''
                UPDATE practice_sessions SET is_favorite = ? WHERE id = ?
            ''', (new_status, session_id))

            conn.commit()

            return jsonify({
                'status': 'success',
                'isFavorite': new_status
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@practice_sessions_bp.route('/practice-sessions/<session_id>', methods=['DELETE'])
def delete_practice_session(session_id):
    """
    Delete a practice session.

    Path Parameters:
        session_id: Practice session ID

    Returns:
        Success status
    """
    try:
        with get_db() as conn:
            conn.execute('DELETE FROM practice_sessions WHERE id = ?', (session_id,))
            conn.commit()

            return jsonify({'status': 'success'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== VIDEO CONTEXT EXTRACTION =====

def extract_video_id(url):
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$'  # Just the video ID
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def get_video_title(video_id):
    """Get video title using YouTube oEmbed API (no API key needed)."""
    try:
        oembed_url = f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json'
        with urllib.request.urlopen(oembed_url, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get('title', 'YouTube Video')
    except Exception:
        return 'YouTube Video'


@practice_sessions_bp.route('/video/extract-context', methods=['POST'])
def extract_video_context():
    """
    Extract transcript and metadata from a YouTube URL.

    Request Body:
        url: YouTube video URL

    Returns:
        {
            videoId: YouTube video ID
            title: Video title
            thumbnail: Thumbnail URL
            transcript: Extracted transcript text
            duration: (optional) Video duration
        }
    """
    data = request.json
    if not data or not data.get('url'):
        return jsonify({'error': 'No URL provided'}), 400

    url = data.get('url')
    video_id = extract_video_id(url)

    if not video_id:
        return jsonify({'error': 'Invalid YouTube URL'}), 400

    result = {
        'videoId': video_id,
        'title': 'YouTube Video',
        'thumbnail': f'https://img.youtube.com/vi/{video_id}/mqdefault.jpg',
        'transcript': '',
        'duration': None
    }

    # Get video title
    try:
        result['title'] = get_video_title(video_id)
    except Exception as e:
        print(f'Failed to get video title: {e}')

    # Get transcript if available
    if YOUTUBE_TRANSCRIPT_AVAILABLE:
        try:
            # Try to get transcript in various languages
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # Try to get English transcript first, then any available
            transcript = None
            try:
                transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB'])
            except Exception:
                # Get any available transcript and translate if needed
                try:
                    for t in transcript_list:
                        transcript = t
                        break
                except Exception:
                    pass

            if transcript:
                transcript_data = transcript.fetch()
                # Join all transcript segments
                transcript_text = ' '.join([item['text'] for item in transcript_data])
                result['transcript'] = transcript_text

                # Calculate approximate duration from last segment
                if transcript_data:
                    last_segment = transcript_data[-1]
                    result['duration'] = int(last_segment.get('start', 0) + last_segment.get('duration', 0))

        except Exception as e:
            print(f'Failed to get transcript: {e}')
            # Transcript not available, but we can still return video info
    else:
        print('youtube_transcript_api not installed, skipping transcript extraction')

    return jsonify(result)
