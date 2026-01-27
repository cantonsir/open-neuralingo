"""
Segment Learning Routes

Handles Test-Learn-Watch flow for segment-based learning.
"""

import json
import time
import uuid
from flask import Blueprint, request, jsonify

from app.database import get_db_connection
from app.config import Config


segment_learning_bp = Blueprint('segment_learning', __name__)


@segment_learning_bp.route('/segment-learning/<goal_id>/<int:segment_index>/mastery', methods=['GET'])
def get_segment_mastery(goal_id, segment_index):
    """
    Get mastery status for a segment.
    
    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number
    
    Returns:
        Mastery status object
    """
    try:
        conn = get_db_connection()
        
        mastery = conn.execute('''
            SELECT * FROM segment_mastery 
            WHERE goal_id = ? AND segment_index = ?
        ''', (goal_id, segment_index)).fetchone()
        
        conn.close()
        
        if mastery:
            return jsonify({
                'testAttempts': mastery['test_attempts'],
                'bestAccuracy': mastery['best_accuracy'],
                'isMastered': bool(mastery['is_mastered']),
                'videoWatched': bool(mastery['video_watched']),
                'lastTestAt': mastery['last_test_at']
            })
        else:
            return jsonify({
                'testAttempts': 0,
                'bestAccuracy': 0.0,
                'isMastered': False,
                'videoWatched': False,
                'lastTestAt': None
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@segment_learning_bp.route('/segment-learning/<goal_id>/<int:segment_index>/test', methods=['POST'])
def save_segment_test(goal_id, segment_index):
    """
    Save a segment test result.
    
    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number
    
    Request Body:
        sentences: AI-generated test sentences
        responses: User behavior data
        analysis: AI feedback
    
    Returns:
        Test result with score and mastery status
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    sentences = data.get('sentences', [])
    responses = data.get('responses', [])
    analysis = data.get('analysis', {})
    
    if not sentences or not responses:
        return jsonify({'error': 'Missing sentences or responses'}), 400
    
    try:
        conn = get_db_connection()
        taken_at = int(time.time() * 1000)
        
        # Get current attempt number
        existing = conn.execute('''
            SELECT MAX(attempt_number) as max_attempt FROM segment_tests 
            WHERE goal_id = ? AND segment_index = ?
        ''', (goal_id, segment_index)).fetchone()
        
        attempt_number = (existing['max_attempt'] or 0) + 1
        
        # Calculate score
        total_questions = len(responses)
        score = sum(1 for r in responses if r.get('understood', False))
        accuracy = score / total_questions if total_questions > 0 else 0.0
        
        test_id = str(uuid.uuid4())
        
        # Save test
        conn.execute('''
            INSERT INTO segment_tests 
            (id, goal_id, segment_index, attempt_number, sentences_json, 
             taken_at, score, total_questions, accuracy, analysis_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            test_id,
            goal_id,
            segment_index,
            attempt_number,
            json.dumps(sentences),
            taken_at,
            score,
            total_questions,
            accuracy,
            json.dumps(analysis)
        ))
        
        # Save test details
        for i, resp in enumerate(responses):
            conn.execute('''
                INSERT INTO segment_test_details
                (id, test_id, question_index, sentence, understood, 
                 replays, reaction_time_ms, marked_indices)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()),
                test_id,
                i,
                resp.get('sentence', ''),
                resp.get('understood', False),
                resp.get('replays', 0),
                resp.get('reactionTimeMs', 0),
                json.dumps(resp.get('markedIndices', []))
            ))
        
        # Update mastery record
        is_mastered = accuracy >= Config.MASTERY_THRESHOLD
        conn.execute('''
            INSERT INTO segment_mastery 
            (goal_id, segment_index, test_attempts, best_accuracy, is_mastered, last_test_at)
            VALUES (?, ?, 1, ?, ?, ?)
            ON CONFLICT(goal_id, segment_index) DO UPDATE SET
                test_attempts = test_attempts + 1,
                best_accuracy = MAX(best_accuracy, excluded.best_accuracy),
                is_mastered = CASE WHEN excluded.best_accuracy >= ? THEN TRUE ELSE is_mastered END,
                last_test_at = excluded.last_test_at
        ''', (goal_id, segment_index, accuracy, is_mastered, taken_at, Config.MASTERY_THRESHOLD))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'testId': test_id,
            'attemptNumber': attempt_number,
            'score': score,
            'accuracy': accuracy,
            'isMastered': is_mastered
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@segment_learning_bp.route('/segment-learning/<goal_id>/<int:segment_index>/tests', methods=['GET'])
def get_segment_tests(goal_id, segment_index):
    """
    Get all test attempts for a segment.
    
    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number
    
    Returns:
        Array of test attempt objects
    """
    try:
        conn = get_db_connection()
        
        tests = conn.execute('''
            SELECT * FROM segment_tests 
            WHERE goal_id = ? AND segment_index = ?
            ORDER BY attempt_number DESC
        ''', (goal_id, segment_index)).fetchall()
        
        result = []
        for test in tests:
            t = dict(test)
            
            details = conn.execute('''
                SELECT * FROM segment_test_details 
                WHERE test_id = ? 
                ORDER BY question_index
            ''', (t['id'],)).fetchall()
            
            test_responses = [
                {
                    'sentence': dict(d)['sentence'],
                    'understood': bool(dict(d)['understood']),
                    'replays': dict(d)['replays'],
                    'reactionTimeMs': dict(d)['reaction_time_ms'],
                    'markedIndices': json.loads(dict(d)['marked_indices']) if dict(d)['marked_indices'] else []
                }
                for d in details
            ]
            
            result.append({
                'id': t['id'],
                'attemptNumber': t['attempt_number'],
                'takenAt': t['taken_at'],
                'score': t['score'],
                'totalQuestions': t['total_questions'],
                'accuracy': t['accuracy'],
                'sentences': json.loads(t['sentences_json']) if t['sentences_json'] else [],
                'analysis': json.loads(t['analysis_json']) if t['analysis_json'] else None,
                'responses': test_responses
            })
        
        conn.close()
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@segment_learning_bp.route('/segment-learning/<goal_id>/<int:segment_index>/lessons', methods=['POST'])
def save_segment_lessons(goal_id, segment_index):
    """
    Save AI-generated lessons based on test mistakes.
    
    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number
    
    Request Body:
        testId: Related test ID
        lessons: Array of lesson objects
    
    Returns:
        Created lesson IDs
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    test_id = data.get('testId')
    lessons = data.get('lessons', [])
    
    if not lessons:
        return jsonify({'error': 'No lessons provided'}), 400
    
    try:
        conn = get_db_connection()
        created_at = int(time.time() * 1000)
        
        lesson_ids = []
        for lesson in lessons:
            lesson_id = str(uuid.uuid4())
            conn.execute('''
                INSERT INTO segment_lessons 
                (id, goal_id, segment_index, test_id, lesson_type, content_json, created_at, completed)
                VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)
            ''', (
                lesson_id,
                goal_id,
                segment_index,
                test_id,
                lesson.get('type', 'general'),
                json.dumps(lesson.get('content', {})),
                created_at
            ))
            lesson_ids.append(lesson_id)
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'lessonIds': lesson_ids,
            'count': len(lesson_ids)
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@segment_learning_bp.route('/segment-learning/<goal_id>/<int:segment_index>/lessons', methods=['GET'])
def get_segment_lessons(goal_id, segment_index):
    """
    Get all lessons for a segment.
    
    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number
    
    Returns:
        Array of lesson objects
    """
    try:
        conn = get_db_connection()
        
        lessons = conn.execute('''
            SELECT * FROM segment_lessons 
            WHERE goal_id = ? AND segment_index = ?
            ORDER BY created_at DESC
        ''', (goal_id, segment_index)).fetchall()
        
        result = [
            {
                'id': dict(l)['id'],
                'testId': dict(l)['test_id'],
                'type': dict(l)['lesson_type'],
                'content': json.loads(dict(l)['content_json']) if dict(l)['content_json'] else {},
                'createdAt': dict(l)['created_at'],
                'completed': bool(dict(l)['completed'])
            }
            for l in lessons
        ]
        
        conn.close()
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@segment_learning_bp.route('/segment-learning/<goal_id>/<int:segment_index>/lessons/<lesson_id>/complete', methods=['POST'])
def complete_segment_lesson(goal_id, segment_index, lesson_id):
    """
    Mark a lesson as completed.
    
    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number
        lesson_id: Lesson ID to complete
    
    Returns:
        Success status
    """
    try:
        conn = get_db_connection()
        conn.execute('UPDATE segment_lessons SET completed = TRUE WHERE id = ?', (lesson_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@segment_learning_bp.route('/segment-learning/<goal_id>/<int:segment_index>/watch', methods=['POST'])
def mark_segment_watched(goal_id, segment_index):
    """
    Mark a segment as watched (video completed).
    
    Path Parameters:
        goal_id: Goal video ID
        segment_index: Segment number
    
    Returns:
        Success status
    """
    try:
        conn = get_db_connection()
        
        conn.execute('''
            INSERT INTO segment_mastery (goal_id, segment_index, video_watched)
            VALUES (?, ?, TRUE)
            ON CONFLICT(goal_id, segment_index) DO UPDATE SET video_watched = TRUE
        ''', (goal_id, segment_index))
        
        # Update overall progress
        mastery_records = conn.execute('''
            SELECT COUNT(*) as watched FROM segment_mastery 
            WHERE goal_id = ? AND video_watched = TRUE
        ''', (goal_id,)).fetchone()
        
        goal = conn.execute('''
            SELECT total_segments FROM goal_videos WHERE id = ?
        ''', (goal_id,)).fetchone()
        
        if goal and goal['total_segments'] > 0:
            progress = mastery_records['watched'] / goal['total_segments']
            conn.execute('''
                UPDATE goal_videos SET 
                    overall_progress = ?,
                    completed_segments = ?,
                    last_studied_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (progress, mastery_records['watched'], goal_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
