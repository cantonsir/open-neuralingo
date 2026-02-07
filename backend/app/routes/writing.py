"""
Writing Routes

Handles writing session CRUD operations.
"""

import time
import uuid
import json
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


@writing_bp.route('/writing/reviews', methods=['GET'])
def get_writing_reviews():
    """Get saved AI writing reviews, optionally filtered by sessionId."""
    session_id = request.args.get('sessionId')

    try:
        with get_db() as conn:
            if session_id:
                rows = conn.execute('''
                    SELECT * FROM writing_ai_reviews
                    WHERE session_id = ?
                    ORDER BY created_at DESC
                ''', (session_id,)).fetchall()
            else:
                rows = conn.execute('''
                    SELECT * FROM writing_ai_reviews
                    ORDER BY created_at DESC
                    LIMIT 200
                ''').fetchall()

            review_list = []
            for row in rows:
                item = dict(row)
                review_list.append({
                    'id': item['id'],
                    'sessionId': item['session_id'],
                    'topic': item['topic'],
                    'originalText': item['original_text'],
                    'correctedText': item['corrected_text'],
                    'score': item['score'],
                    'strengths': json.loads(item['strengths_json']) if item['strengths_json'] else [],
                    'weaknesses': json.loads(item['weaknesses_json']) if item['weaknesses_json'] else [],
                    'suggestions': json.loads(item['suggestions_json']) if item['suggestions_json'] else [],
                    'createdAt': item['created_at'],
                })

            return jsonify(review_list)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@writing_bp.route('/writing/reviews', methods=['POST'])
def save_writing_review():
    """Save an AI writing review result for later learner review."""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required_fields = ['topic', 'originalText', 'correctedText', 'score']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    try:
        with get_db() as conn:
            review_id = str(uuid.uuid4())
            created_at = data.get('createdAt', int(time.time() * 1000))

            conn.execute('''
                INSERT INTO writing_ai_reviews
                (id, session_id, topic, original_text, corrected_text, score,
                 strengths_json, weaknesses_json, suggestions_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                review_id,
                data.get('sessionId'),
                data.get('topic', 'Untitled'),
                data.get('originalText', ''),
                data.get('correctedText', ''),
                int(data.get('score', 0)),
                json.dumps(data.get('strengths', [])),
                json.dumps(data.get('weaknesses', [])),
                json.dumps(data.get('suggestions', [])),
                created_at,
            ))

            conn.commit()
            return jsonify({'status': 'success', 'id': review_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@writing_bp.route('/writing/sessions/<session_id>', methods=['DELETE'])
def delete_writing_session(session_id):
    """Delete a writing session by ID."""
    try:
        with get_db() as conn:
            conn.execute(
                'DELETE FROM writing_ai_reviews WHERE session_id = ?',
                (session_id,)
            )

            result = conn.execute(
                'DELETE FROM writing_sessions WHERE id = ?',
                (session_id,)
            )
            conn.commit()

            if result.rowcount == 0:
                return jsonify({'error': 'Session not found'}), 404

            return jsonify({'status': 'success'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== WRITING ASSESSMENT PROFILE =====

@writing_bp.route('/writing/profile', methods=['GET'])
def get_writing_profile():
    """Get the user's writing assessment profile."""
    try:
        with get_db() as conn:
            profile = conn.execute('''
                SELECT * FROM writing_profiles
                ORDER BY created_at DESC
                LIMIT 1
            ''').fetchone()

            if not profile:
                return jsonify(None)

            p = dict(profile)
            return jsonify({
                'id': p['id'],
                'targetLanguage': p['target_language'],
                'firstLanguage': p['first_language'],
                'writingLevel': p['writing_level'],
                'writingPurposes': json.loads(p['writing_purposes']) if p['writing_purposes'] else [],
                'difficulties': json.loads(p['difficulties']) if p['difficulties'] else [],
                'goals': json.loads(p['goals']) if p['goals'] else [],
                'interests': p['interests'],
                'createdAt': p['created_at'],
                'updatedAt': p['updated_at']
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@writing_bp.route('/writing/profile', methods=['POST'])
def save_writing_profile():
    """Save or update writing assessment profile."""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        with get_db() as conn:
            existing = conn.execute('''
                SELECT id FROM writing_profiles
                ORDER BY created_at DESC
                LIMIT 1
            ''').fetchone()

            timestamp = int(time.time() * 1000)

            if existing:
                profile_id = existing['id']
                conn.execute('''
                    UPDATE writing_profiles
                    SET target_language = ?,
                        first_language = ?,
                        writing_level = ?,
                        writing_purposes = ?,
                        difficulties = ?,
                        goals = ?,
                        interests = ?,
                        updated_at = ?
                    WHERE id = ?
                ''', (
                    data.get('targetLanguage', 'en'),
                    data.get('firstLanguage', 'en'),
                    data.get('writingLevel', 2),
                    json.dumps(data.get('writingPurposes', [])),
                    json.dumps(data.get('difficulties', [])),
                    json.dumps(data.get('goals', [])),
                    data.get('interests', ''),
                    timestamp,
                    profile_id
                ))
            else:
                profile_id = str(uuid.uuid4())
                conn.execute('''
                    INSERT INTO writing_profiles
                    (id, user_id, target_language, first_language, writing_level,
                     writing_purposes, difficulties, goals, interests, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    profile_id,
                    'default_user',
                    data.get('targetLanguage', 'en'),
                    data.get('firstLanguage', 'en'),
                    data.get('writingLevel', 2),
                    json.dumps(data.get('writingPurposes', [])),
                    json.dumps(data.get('difficulties', [])),
                    json.dumps(data.get('goals', [])),
                    data.get('interests', ''),
                    timestamp,
                    timestamp
                ))

            conn.commit()
            return jsonify({'status': 'success', 'id': profile_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== WRITING ASSESSMENT RESULTS =====

@writing_bp.route('/writing/assessment', methods=['POST'])
def save_writing_assessment():
    """Save writing assessment results."""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        with get_db() as conn:
            assessment_id = str(uuid.uuid4())
            timestamp = int(time.time() * 1000)

            analysis = data.get('analysis', {})
            responses = data.get('responses', [])

            statistics = analysis.get('statistics', {}) if analysis else {}

            conn.execute('''
                INSERT INTO writing_assessments
                (id, profile_id, taken_at, prompts, responses, analysis,
                 overall_level, grammar_level, vocabulary_level,
                 translation_accuracy, self_correction_rate,
                 total_sentences, sentences_with_errors, sentences_corrected,
                 avg_translation_time, avg_correction_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                assessment_id,
                data.get('profileId'),
                timestamp,
                json.dumps(data.get('prompts', [])),
                json.dumps(responses),
                json.dumps(analysis),
                analysis.get('overallLevel', 0),
                analysis.get('grammarLevel', 0),
                analysis.get('vocabularyLevel', 0),
                analysis.get('translationAccuracy', 0),
                analysis.get('selfCorrectionRate', 0),
                statistics.get('totalSentences', len(responses)),
                statistics.get('sentencesWithErrors', 0),
                statistics.get('sentencesCorrected', 0),
                statistics.get('avgTranslationTime', 0),
                statistics.get('avgCorrectionTime', 0)
            ))

            conn.commit()
            return jsonify({'status': 'success', 'id': assessment_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@writing_bp.route('/writing/assessments', methods=['GET'])
def get_writing_assessments():
    """Get all writing assessments (summary)."""
    try:
        with get_db() as conn:
            assessments = conn.execute('''
                SELECT * FROM writing_assessments
                ORDER BY taken_at DESC
            ''').fetchall()

            assessment_list = []
            for assessment in assessments:
                item = dict(assessment)
                assessment_list.append({
                    'id': item['id'],
                    'profileId': item['profile_id'],
                    'takenAt': item['taken_at'],
                    'overallLevel': item['overall_level'],
                    'grammarLevel': item['grammar_level'],
                    'vocabularyLevel': item['vocabulary_level'],
                    'translationAccuracy': item['translation_accuracy'],
                    'selfCorrectionRate': item['self_correction_rate'],
                    'totalSentences': item['total_sentences'],
                    'sentencesWithErrors': item['sentences_with_errors'],
                    'sentencesCorrected': item['sentences_corrected']
                })

            return jsonify(assessment_list)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@writing_bp.route('/writing/assessment/<assessment_id>', methods=['GET'])
def get_writing_assessment(assessment_id):
    """Get a specific writing assessment with full details."""
    try:
        with get_db() as conn:
            assessment = conn.execute('''
                SELECT * FROM writing_assessments
                WHERE id = ?
            ''', (assessment_id,)).fetchone()

            if not assessment:
                return jsonify({'error': 'Assessment not found'}), 404

            item = dict(assessment)

            return jsonify({
                'id': item['id'],
                'profileId': item['profile_id'],
                'takenAt': item['taken_at'],
                'prompts': json.loads(item['prompts']) if item['prompts'] else [],
                'responses': json.loads(item['responses']) if item['responses'] else [],
                'analysis': json.loads(item['analysis']) if item['analysis'] else {},
                'overallLevel': item['overall_level'],
                'grammarLevel': item['grammar_level'],
                'vocabularyLevel': item['vocabulary_level'],
                'translationAccuracy': item['translation_accuracy'],
                'selfCorrectionRate': item['self_correction_rate'],
                'totalSentences': item['total_sentences'],
                'sentencesWithErrors': item['sentences_with_errors'],
                'sentencesCorrected': item['sentences_corrected'],
                'avgTranslationTime': item['avg_translation_time'],
                'avgCorrectionTime': item['avg_correction_time']
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
