"""
Speaking Routes

Handles speaking session history, conversation storage,
and speaking assessment (profile, test results, statistics).
"""

import time
import json
import uuid
from flask import Blueprint, request, jsonify

from app.database import get_db


speaking_bp = Blueprint('speaking', __name__)


@speaking_bp.route('/speaking/sessions', methods=['GET'])
def get_speaking_sessions():
    """
    Get all speaking sessions.
    
    Returns:
        Array of speaking session objects
    """
    try:
        with get_db() as conn:
            sessions = conn.execute('''
                SELECT * FROM speaking_sessions 
                ORDER BY created_at DESC
            ''').fetchall()
            
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
        with get_db() as conn:
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
            
            return jsonify({'status': 'success', 'id': session_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@speaking_bp.route('/speaking/sessions/<session_id>', methods=['DELETE'])
def delete_speaking_session(session_id):
    """
    Delete a speaking session by ID.
    
    Args:
        session_id: The ID of the session to delete
    
    Returns:
        Success status
    """
    try:
        with get_db() as conn:
            result = conn.execute(
                'DELETE FROM speaking_sessions WHERE id = ?',
                (session_id,)
            )
            conn.commit()
            
            if result.rowcount == 0:
                return jsonify({'error': 'Session not found'}), 404

            return jsonify({'status': 'success'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== SPEAKING ASSESSMENT PROFILE =====

@speaking_bp.route('/speaking/profile', methods=['GET'])
def get_speaking_profile():
    """Get the user's speaking assessment profile."""
    try:
        with get_db() as conn:
            profile = conn.execute('''
                SELECT * FROM speaking_profiles
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
                'speakingLevel': p['speaking_level'],
                'contextPreferences': json.loads(p['context_preferences']) if p['context_preferences'] else [],
                'speakingComfort': p['speaking_comfort'],
                'difficulties': json.loads(p['difficulties']) if p['difficulties'] else [],
                'goals': json.loads(p['goals']) if p['goals'] else [],
                'interests': p['interests'],
                'createdAt': p['created_at'],
                'updatedAt': p['updated_at']
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@speaking_bp.route('/speaking/profile', methods=['POST'])
def save_speaking_profile():
    """Save or update speaking assessment profile."""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        with get_db() as conn:
            existing = conn.execute('''
                SELECT id FROM speaking_profiles
                ORDER BY created_at DESC
                LIMIT 1
            ''').fetchone()

            timestamp = int(time.time() * 1000)

            if existing:
                profile_id = existing['id']
                conn.execute('''
                    UPDATE speaking_profiles
                    SET target_language = ?,
                        first_language = ?,
                        speaking_level = ?,
                        context_preferences = ?,
                        speaking_comfort = ?,
                        difficulties = ?,
                        goals = ?,
                        interests = ?,
                        updated_at = ?
                    WHERE id = ?
                ''', (
                    data.get('targetLanguage', 'en'),
                    data.get('firstLanguage', 'en'),
                    data.get('speakingLevel', 2),
                    json.dumps(data.get('contextPreferences', [])),
                    data.get('speakingComfort', 'moderate'),
                    json.dumps(data.get('difficulties', [])),
                    json.dumps(data.get('goals', [])),
                    data.get('interests', ''),
                    timestamp,
                    profile_id
                ))
            else:
                profile_id = str(uuid.uuid4())
                conn.execute('''
                    INSERT INTO speaking_profiles
                    (id, user_id, target_language, first_language, speaking_level,
                     context_preferences, speaking_comfort, difficulties, goals,
                     interests, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    profile_id,
                    'default_user',
                    data.get('targetLanguage', 'en'),
                    data.get('firstLanguage', 'en'),
                    data.get('speakingLevel', 2),
                    json.dumps(data.get('contextPreferences', [])),
                    data.get('speakingComfort', 'moderate'),
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


# ===== SPEAKING ASSESSMENT RESULTS =====

@speaking_bp.route('/speaking/assessment', methods=['POST'])
def save_speaking_assessment():
    """Save speaking assessment results."""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        with get_db() as conn:
            assessment_id = str(uuid.uuid4())
            timestamp = int(time.time() * 1000)

            analysis = data.get('analysis', {})
            responses = data.get('responses', [])

            total_prompts = len(responses)
            accuracies = [r.get('accuracy', 0) for r in responses if r.get('accuracy') is not None]
            avg_accuracy = sum(accuracies) / len(accuracies) if accuracies else 0
            response_times = [r.get('responseTimeMs', 0) for r in responses]
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0

            conn.execute('''
                INSERT INTO speaking_assessments
                (id, profile_id, taken_at, prompts, responses, conversation_transcript,
                 analysis, overall_level, pronunciation_level, grammar_level,
                 vocabulary_level, fluency_level, primary_barrier,
                 translation_accuracy, conversation_coherence,
                 total_prompts, avg_accuracy, avg_response_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                assessment_id,
                data.get('profileId'),
                timestamp,
                json.dumps(data.get('prompts', [])),
                json.dumps(responses),
                json.dumps(data.get('conversationTranscript', [])),
                json.dumps(analysis),
                analysis.get('overallLevel', 0),
                analysis.get('pronunciationLevel', 0),
                analysis.get('grammarLevel', 0),
                analysis.get('vocabularyLevel', 0),
                analysis.get('fluencyLevel', 0),
                analysis.get('primaryBarrier', 'balanced'),
                analysis.get('translationAccuracy', 0),
                analysis.get('conversationCoherence', 0),
                total_prompts,
                avg_accuracy,
                avg_response_time
            ))

            conn.commit()
            return jsonify({'status': 'success', 'id': assessment_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@speaking_bp.route('/speaking/assessments', methods=['GET'])
def get_speaking_assessments():
    """Get all speaking assessments (summary)."""
    try:
        with get_db() as conn:
            assessments = conn.execute('''
                SELECT * FROM speaking_assessments
                ORDER BY taken_at DESC
            ''').fetchall()

            assessment_list = []
            for a in assessments:
                ass = dict(a)
                assessment_list.append({
                    'id': ass['id'],
                    'profileId': ass['profile_id'],
                    'takenAt': ass['taken_at'],
                    'overallLevel': ass['overall_level'],
                    'pronunciationLevel': ass['pronunciation_level'],
                    'grammarLevel': ass['grammar_level'],
                    'vocabularyLevel': ass['vocabulary_level'],
                    'fluencyLevel': ass['fluency_level'],
                    'primaryBarrier': ass['primary_barrier'],
                    'translationAccuracy': ass['translation_accuracy'],
                    'conversationCoherence': ass['conversation_coherence'],
                    'totalPrompts': ass['total_prompts'],
                    'avgAccuracy': ass['avg_accuracy']
                })

            return jsonify(assessment_list)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@speaking_bp.route('/speaking/assessment/<assessment_id>', methods=['GET'])
def get_speaking_assessment(assessment_id):
    """Get a specific speaking assessment with full details."""
    try:
        with get_db() as conn:
            assessment = conn.execute('''
                SELECT * FROM speaking_assessments
                WHERE id = ?
            ''', (assessment_id,)).fetchone()

            if not assessment:
                return jsonify({'error': 'Assessment not found'}), 404

            a = dict(assessment)
            return jsonify({
                'id': a['id'],
                'profileId': a['profile_id'],
                'takenAt': a['taken_at'],
                'prompts': json.loads(a['prompts']) if a['prompts'] else [],
                'responses': json.loads(a['responses']) if a['responses'] else [],
                'conversationTranscript': json.loads(a['conversation_transcript']) if a['conversation_transcript'] else [],
                'analysis': json.loads(a['analysis']) if a['analysis'] else {},
                'overallLevel': a['overall_level'],
                'pronunciationLevel': a['pronunciation_level'],
                'grammarLevel': a['grammar_level'],
                'vocabularyLevel': a['vocabulary_level'],
                'fluencyLevel': a['fluency_level'],
                'primaryBarrier': a['primary_barrier'],
                'translationAccuracy': a['translation_accuracy'],
                'conversationCoherence': a['conversation_coherence'],
                'totalPrompts': a['total_prompts'],
                'avgAccuracy': a['avg_accuracy'],
                'avgResponseTime': a['avg_response_time']
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@speaking_bp.route('/speaking/statistics', methods=['GET'])
def get_speaking_statistics():
    """Get speaking assessment statistics for charts and progress tracking."""
    try:
        window = request.args.get('window', 'last_10')

        with get_db() as conn:
            if window == 'last_10':
                assessments = conn.execute('''
                    SELECT * FROM speaking_assessments
                    ORDER BY taken_at DESC
                    LIMIT 10
                ''').fetchall()
            elif window == 'last_30':
                thirty_days_ago = int(time.time() * 1000) - (30 * 24 * 60 * 60 * 1000)
                assessments = conn.execute('''
                    SELECT * FROM speaking_assessments
                    WHERE taken_at >= ?
                    ORDER BY taken_at DESC
                ''', (thirty_days_ago,)).fetchall()
            else:
                assessments = conn.execute('''
                    SELECT * FROM speaking_assessments
                    ORDER BY taken_at DESC
                ''').fetchall()

            if not assessments:
                return jsonify({
                    'summary': {
                        'totalTests': 0,
                        'avgTranslationAccuracy': 0,
                        'avgConversationCoherence': 0,
                        'currentLevel': 0,
                        'bestAccuracy': 0,
                        'improvementRate': '0%'
                    },
                    'scoreTrend': [],
                    'weaknessEvolution': {},
                    'computedAt': int(time.time() * 1000)
                })

            assessment_list = [dict(a) for a in assessments]
            assessment_list.reverse()

            total_tests = len(assessment_list)
            accuracies = [a['translation_accuracy'] for a in assessment_list]
            coherences = [a['conversation_coherence'] for a in assessment_list]

            avg_accuracy = sum(accuracies) / total_tests if total_tests > 0 else 0
            avg_coherence = sum(coherences) / total_tests if total_tests > 0 else 0
            current_level = assessment_list[-1]['overall_level'] if assessment_list else 0
            best_accuracy = max(accuracies) if accuracies else 0

            if total_tests >= 2:
                first_half = assessment_list[:total_tests // 2]
                second_half = assessment_list[total_tests // 2:]
                first_avg = sum(a['translation_accuracy'] for a in first_half) / len(first_half)
                second_avg = sum(a['translation_accuracy'] for a in second_half) / len(second_half)
                improvement = second_avg - first_avg
                improvement_rate = f"+{improvement:.1f}%" if improvement >= 0 else f"{improvement:.1f}%"
            else:
                improvement_rate = "N/A"

            score_trend = []
            for i, a in enumerate(assessment_list):
                score_trend.append({
                    'testNumber': i + 1,
                    'date': a['taken_at'],
                    'translationAccuracy': a['translation_accuracy'],
                    'conversationCoherence': a['conversation_coherence'],
                    'overallLevel': a['overall_level']
                })

            weakness_evolution = {
                'pronunciation': [],
                'grammar': [],
                'vocabulary': [],
                'fluency': []
            }

            for a in assessment_list:
                analysis = json.loads(a['analysis']) if a['analysis'] else {}
                grammar_errors = analysis.get('grammarErrors', [])
                vocab_gaps = analysis.get('vocabularyGaps', [])

                weakness_evolution['pronunciation'].append(
                    5 - (analysis.get('pronunciationLevel', 3))
                )
                weakness_evolution['grammar'].append(
                    sum(e.get('count', 0) for e in grammar_errors)
                )
                weakness_evolution['vocabulary'].append(
                    sum(g.get('count', 0) for g in vocab_gaps)
                )
                weakness_evolution['fluency'].append(
                    5 - (analysis.get('fluencyLevel', 3))
                )

            return jsonify({
                'summary': {
                    'totalTests': total_tests,
                    'avgTranslationAccuracy': avg_accuracy,
                    'avgConversationCoherence': avg_coherence,
                    'currentLevel': current_level,
                    'bestAccuracy': best_accuracy,
                    'improvementRate': improvement_rate
                },
                'scoreTrend': score_trend,
                'weaknessEvolution': weakness_evolution,
                'computedAt': int(time.time() * 1000)
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
