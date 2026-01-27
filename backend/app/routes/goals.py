"""
Goals Routes

Handles CRUD operations for learning goal videos.
"""

import json
import uuid
from flask import Blueprint, request, jsonify
from youtube_transcript_api import YouTubeTranscriptApi

from app.database import get_db_connection
from app.config import Config


goals_bp = Blueprint('goals', __name__)


def _calculate_segments(duration_seconds: int, segment_duration: int) -> int:
    """
    Calculate total segments, merging small final segments with previous.
    
    Args:
        duration_seconds: Total video duration in seconds
        segment_duration: Target segment duration in seconds
    
    Returns:
        Number of segments
    """
    if duration_seconds <= segment_duration:
        return 1
    return duration_seconds // segment_duration


@goals_bp.route('/goals', methods=['GET'])
def get_goal_videos():
    """
    Get all goal videos for learning.
    
    Returns:
        JSON array of goal video objects
    """
    try:
        conn = get_db_connection()
        goals = conn.execute('''
            SELECT * FROM goal_videos 
            ORDER BY last_studied_at DESC, created_at DESC
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


@goals_bp.route('/goals', methods=['POST'])
def create_goal_video():
    """
    Add a new goal video for learning.
    
    Request Body:
        videoId: YouTube video ID
        language: Target language code (default: 'en')
        segmentDuration: Segment duration in seconds (default: 240)
        title: Optional video title
    
    Returns:
        Created goal with ID and segment info
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_id = data.get('videoId')
    language = data.get('language', 'en')
    
    if not video_id:
        return jsonify({'error': 'Missing videoId'}), 400
    
    try:
        conn = get_db_connection()
        
        # Check if already exists with same language
        existing = conn.execute(
            'SELECT id FROM goal_videos WHERE video_id = ? AND language = ?',
            (video_id, language)
        ).fetchone()
        
        if existing:
            conn.close()
            return jsonify({'status': 'exists', 'id': existing['id']}), 200
        
        # Fetch transcript from YouTube
        ytt_api = YouTubeTranscriptApi()
        try:
            transcript_obj = ytt_api.fetch(video_id, languages=[language])
        except Exception:
            transcript_obj = ytt_api.fetch(video_id)
        
        transcript_data = transcript_obj.to_raw_data()
        
        # Calculate duration and segments
        if transcript_data:
            last_item = transcript_data[-1]
            duration_seconds = int(last_item['start'] + last_item['duration'])
        else:
            duration_seconds = 0
        
        segment_duration = data.get('segmentDuration', Config.DEFAULT_SEGMENT_DURATION)
        total_segments = _calculate_segments(duration_seconds, segment_duration)
        
        title = data.get('title', f'YouTube Video ({video_id})')
        goal_id = str(uuid.uuid4())
        
        conn.execute('''
            INSERT INTO goal_videos 
            (id, video_id, title, thumbnail, language, duration_seconds, 
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
        
        # Initialize first segment as unlocked
        conn.execute('''
            INSERT OR REPLACE INTO segment_progress 
            (video_id, segment_index, total_items, completed_items, is_unlocked)
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


@goals_bp.route('/goals/<goal_id>', methods=['GET'])
def get_goal_video(goal_id):
    """
    Get a specific goal video with its segments.
    
    Path Parameters:
        goal_id: Goal video ID
    
    Returns:
        Goal video details with segment information
    """
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
        video_end_time = transcript[-1]['start'] + transcript[-1]['duration'] if transcript else 0
        
        segments = _build_segments(conn, goal_id, transcript, segment_duration, video_end_time)
        
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


def _build_segments(conn, goal_id, transcript, segment_duration, video_end_time):
    """Build segment list with mastery information."""
    segments = []
    current_segment = []
    segment_start = 0
    segment_index = 0
    
    for item in transcript:
        time_elapsed = item['start'] - segment_start
        remaining_time = video_end_time - item['start']
        
        if time_elapsed >= segment_duration and current_segment and remaining_time >= segment_duration:
            segment_info = _get_segment_info(
                conn, goal_id, segment_index, segment_start, 
                item['start'], current_segment
            )
            segments.append(segment_info)
            
            current_segment = []
            segment_start = item['start']
            segment_index += 1
        
        current_segment.append(item)
    
    # Add last segment
    if current_segment:
        segment_info = _get_segment_info(
            conn, goal_id, segment_index, segment_start,
            video_end_time, current_segment
        )
        segments.append(segment_info)
    
    return segments


def _get_segment_info(conn, goal_id, segment_index, start_time, end_time, items):
    """Get segment info with mastery status."""
    mastery = conn.execute('''
        SELECT * FROM segment_mastery WHERE goal_id = ? AND segment_index = ?
    ''', (goal_id, segment_index)).fetchone()
    
    # Check if previous segment is complete
    prev_complete = True
    if segment_index > 0:
        prev_mastery = conn.execute('''
            SELECT video_watched FROM segment_mastery 
            WHERE goal_id = ? AND segment_index = ?
        ''', (goal_id, segment_index - 1)).fetchone()
        prev_complete = prev_mastery and prev_mastery['video_watched']
    
    is_unlocked = segment_index == 0 or prev_complete
    is_complete = mastery and mastery['video_watched']
    
    return {
        'index': segment_index,
        'startTime': start_time,
        'endTime': end_time,
        'sentences': len(items),
        'preview': items[0]['text'][:50] + '...' if items else '',
        'isUnlocked': is_unlocked,
        'progress': 100 if is_complete else 0
    }


@goals_bp.route('/goals/<goal_id>', methods=['DELETE'])
def delete_goal_video(goal_id):
    """
    Delete a goal video and its associated data.
    
    Path Parameters:
        goal_id: Goal video ID to delete
    
    Returns:
        Deletion status
    """
    try:
        conn = get_db_connection()
        
        # Delete associated data
        conn.execute('''
            DELETE FROM lesson_progress 
            WHERE item_id IN (SELECT id FROM lesson_items WHERE video_id = ?)
        ''', (goal_id,))
        conn.execute('DELETE FROM lesson_items WHERE video_id = ?', (goal_id,))
        conn.execute('DELETE FROM segment_progress WHERE video_id = ?', (goal_id,))
        conn.execute('DELETE FROM goal_videos WHERE id = ?', (goal_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'deleted'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@goals_bp.route('/goals/<goal_id>/segment/<int:segment_index>/sentences', methods=['GET'])
def get_segment_sentences(goal_id, segment_index):
    """
    Get sentences for a specific segment of a goal video.
    
    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number
    
    Returns:
        Array of sentences for the segment
    """
    try:
        conn = get_db_connection()
        
        goal = conn.execute(
            'SELECT transcript, segment_duration FROM goal_videos WHERE id = ?',
            (goal_id,)
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
            if segment_start <= item['start'] < segment_end
        ]
        
        conn.close()
        
        return jsonify({
            'segmentIndex': segment_index,
            'sentences': sentences,
            'count': len(sentences)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
