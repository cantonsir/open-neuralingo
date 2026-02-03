"""
Reading Routes

Handles reading session CRUD operations and reading assessments.
"""

import time
import uuid
import json
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


@reading_bp.route('/reading/sessions/<session_id>', methods=['DELETE'])
def delete_reading_session(session_id):
    """
    Delete a reading session.
    
    Args:
        session_id: ID of the session to delete
    
    Returns:
        Success status
    """
    try:
        with get_db() as conn:
            result = conn.execute(
                'DELETE FROM reading_sessions WHERE id = ?',
                (session_id,)
            )
            conn.commit()
            
            if result.rowcount == 0:
                return jsonify({'error': 'Session not found'}), 404
            
            return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== READING ASSESSMENT PROFILE =====

@reading_bp.route('/reading/profile', methods=['GET'])
def get_reading_profile():
    """
    Get the user's reading assessment profile.

    Returns:
        Reading profile object or None if not found
    """
    try:
        with get_db() as conn:
            # For now, get the most recent profile (in future, filter by user_id)
            profile = conn.execute('''
                SELECT * FROM reading_profiles
                ORDER BY created_at DESC
                LIMIT 1
            ''').fetchone()

            if not profile:
                return jsonify(None)

            p = dict(profile)
            return jsonify({
                'id': p['id'],
                'targetLanguage': p['target_language'],
                'readingLevel': p['reading_level'],
                'contentPreferences': json.loads(p['content_preferences']) if p['content_preferences'] else [],
                'difficulties': json.loads(p['difficulties']) if p['difficulties'] else [],
                'goals': json.loads(p['goals']) if p['goals'] else [],
                'interests': p['interests'],
                'readingSpeed': p['reading_speed'],
                'createdAt': p['created_at'],
                'updatedAt': p['updated_at']
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reading_bp.route('/reading/profile', methods=['POST'])
def save_reading_profile():
    """
    Save or update reading assessment profile.

    Request Body:
        targetLanguage: Target language code
        readingLevel: Reading level (0-4)
        contentPreferences: Array of content type preferences
        readingSpeed: Reading speed preference
        difficulties: Array of difficulty areas
        goals: Array of reading goals
        interests: Free-form interests text

    Returns:
        Saved profile ID
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        with get_db() as conn:
            # Check if profile already exists (update instead of insert)
            existing = conn.execute('''
                SELECT id FROM reading_profiles
                ORDER BY created_at DESC
                LIMIT 1
            ''').fetchone()

            timestamp = int(time.time() * 1000)

            if existing:
                # Update existing profile
                profile_id = existing['id']
                conn.execute('''
                    UPDATE reading_profiles
                    SET target_language = ?,
                        reading_level = ?,
                        content_preferences = ?,
                        difficulties = ?,
                        goals = ?,
                        interests = ?,
                        reading_speed = ?,
                        updated_at = ?
                    WHERE id = ?
                ''', (
                    data.get('targetLanguage', 'en'),
                    data.get('readingLevel', 2),
                    json.dumps(data.get('contentPreferences', [])),
                    json.dumps(data.get('difficulties', [])),
                    json.dumps(data.get('goals', [])),
                    data.get('interests', ''),
                    data.get('readingSpeed', 'moderate'),
                    timestamp,
                    profile_id
                ))
            else:
                # Insert new profile
                profile_id = str(uuid.uuid4())
                conn.execute('''
                    INSERT INTO reading_profiles
                    (id, user_id, target_language, reading_level, content_preferences,
                     difficulties, goals, interests, reading_speed, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    profile_id,
                    'default_user',  # In future, use actual user_id from auth
                    data.get('targetLanguage', 'en'),
                    data.get('readingLevel', 2),
                    json.dumps(data.get('contentPreferences', [])),
                    json.dumps(data.get('difficulties', [])),
                    json.dumps(data.get('goals', [])),
                    data.get('interests', ''),
                    data.get('readingSpeed', 'moderate'),
                    timestamp,
                    timestamp
                ))

            conn.commit()

            return jsonify({'status': 'success', 'id': profile_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== READING ASSESSMENT RESULTS =====

@reading_bp.route('/reading/assessment', methods=['POST'])
def save_reading_assessment():
    """
    Save reading assessment results.

    Request Body:
        profileId: Reading profile ID
        passages: Array of passage objects
        responses: Array of test responses with marked words/sentences
        analysis: Analysis results from AI

    Returns:
        Assessment ID
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        with get_db() as conn:
            assessment_id = str(uuid.uuid4())
            timestamp = int(time.time() * 1000)

            # Extract analysis data
            analysis = data.get('analysis', {})
            responses = data.get('responses', [])
            passages = data.get('passages', [])

            # Calculate totals
            total_words_read = sum(p.get('wordCount', 0) for p in passages)
            total_sentences_read = sum(p.get('sentenceCount', 0) for p in passages)
            total_words_marked = sum(len(r.get('markedWords', [])) for r in responses)
            total_sentences_marked = sum(len(r.get('markedSentences', [])) for r in responses)

            # Insert assessment
            conn.execute('''
                INSERT INTO reading_assessments
                (id, profile_id, taken_at, passages, marked_words, marked_sentences,
                 reading_times, analysis, overall_level, vocabulary_level, grammar_level,
                 primary_barrier, total_words_read, total_words_marked,
                 total_sentences_read, total_sentences_marked,
                 vocabulary_coverage, sentence_comprehension)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                assessment_id,
                data.get('profileId'),
                timestamp,
                json.dumps(passages),
                json.dumps({r['passageId']: r.get('markedWords', []) for r in responses}),
                json.dumps({r['passageId']: r.get('markedSentences', []) for r in responses}),
                json.dumps({r['passageId']: r.get('readingTimeMs', 0) for r in responses}),
                json.dumps(analysis),
                analysis.get('overallLevel', 0),
                analysis.get('vocabularyLevel', 0),
                analysis.get('grammarLevel', 0),
                analysis.get('primaryBarrier', 'balanced'),
                total_words_read,
                total_words_marked,
                total_sentences_read,
                total_sentences_marked,
                analysis.get('statistics', {}).get('vocabularyCoverage', 0),
                analysis.get('statistics', {}).get('sentenceComprehension', 0)
            ))

            # Insert individual test passages
            for response in responses:
                passage_id = str(uuid.uuid4())
                passage = next((p for p in passages if p.get('id') == response.get('passageId')), {})

                conn.execute('''
                    INSERT INTO reading_test_passages
                    (id, assessment_id, title, content, difficulty, content_type,
                     marked_words, marked_sentences, reading_time, word_count, sentence_count,
                     vocabulary_coverage, sentence_comprehension)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    passage_id,
                    assessment_id,
                    response.get('passageTitle', 'Untitled'),
                    response.get('content', ''),
                    response.get('difficulty', 1),
                    passage.get('contentType', 'narrative'),
                    json.dumps(response.get('markedWords', [])),
                    json.dumps(response.get('markedSentences', [])),
                    response.get('readingTimeMs', 0),
                    passage.get('wordCount', 0),
                    passage.get('sentenceCount', 0),
                    0 if passage.get('wordCount', 0) == 0 else ((passage.get('wordCount', 0) - len(response.get('markedWords', []))) / passage.get('wordCount', 0)) * 100,
                    0 if passage.get('sentenceCount', 0) == 0 else ((passage.get('sentenceCount', 0) - len(response.get('markedSentences', []))) / passage.get('sentenceCount', 0)) * 100
                ))

            conn.commit()

            return jsonify({'status': 'success', 'id': assessment_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reading_bp.route('/reading/assessments', methods=['GET'])
def get_reading_assessments():
    """
    Get all reading assessments.

    Returns:
        Array of assessment objects
    """
    try:
        with get_db() as conn:
            assessments = conn.execute('''
                SELECT * FROM reading_assessments
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
                    'vocabularyLevel': ass['vocabulary_level'],
                    'grammarLevel': ass['grammar_level'],
                    'primaryBarrier': ass['primary_barrier'],
                    'totalWordsRead': ass['total_words_read'],
                    'totalWordsMarked': ass['total_words_marked'],
                    'totalSentencesRead': ass['total_sentences_read'],
                    'totalSentencesMarked': ass['total_sentences_marked'],
                    'vocabularyCoverage': ass['vocabulary_coverage'],
                    'sentenceComprehension': ass['sentence_comprehension']
                })

            return jsonify(assessment_list)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reading_bp.route('/reading/assessment/<assessment_id>', methods=['GET'])
def get_reading_assessment(assessment_id):
    """
    Get a specific reading assessment with full details.

    Returns:
        Assessment object with passages and analysis
    """
    try:
        with get_db() as conn:
            assessment = conn.execute('''
                SELECT * FROM reading_assessments
                WHERE id = ?
            ''', (assessment_id,)).fetchone()

            if not assessment:
                return jsonify({'error': 'Assessment not found'}), 404

            a = dict(assessment)

            # Get associated passages
            passages = conn.execute('''
                SELECT * FROM reading_test_passages
                WHERE assessment_id = ?
            ''', (assessment_id,)).fetchall()

            passage_list = []
            for p in passages:
                ps = dict(p)
                passage_list.append({
                    'id': ps['id'],
                    'title': ps['title'],
                    'content': ps['content'],
                    'difficulty': ps['difficulty'],
                    'contentType': ps['content_type'],
                    'markedWords': json.loads(ps['marked_words']) if ps['marked_words'] else [],
                    'markedSentences': json.loads(ps['marked_sentences']) if ps['marked_sentences'] else [],
                    'readingTime': ps['reading_time'],
                    'wordCount': ps['word_count'],
                    'sentenceCount': ps['sentence_count'],
                    'vocabularyCoverage': ps['vocabulary_coverage'],
                    'sentenceComprehension': ps['sentence_comprehension']
                })

            return jsonify({
                'id': a['id'],
                'profileId': a['profile_id'],
                'takenAt': a['taken_at'],
                'passages': json.loads(a['passages']) if a['passages'] else [],
                'markedWords': json.loads(a['marked_words']) if a['marked_words'] else {},
                'markedSentences': json.loads(a['marked_sentences']) if a['marked_sentences'] else {},
                'readingTimes': json.loads(a['reading_times']) if a['reading_times'] else {},
                'analysis': json.loads(a['analysis']) if a['analysis'] else {},
                'overallLevel': a['overall_level'],
                'vocabularyLevel': a['vocabulary_level'],
                'grammarLevel': a['grammar_level'],
                'primaryBarrier': a['primary_barrier'],
                'totalWordsRead': a['total_words_read'],
                'totalWordsMarked': a['total_words_marked'],
                'totalSentencesRead': a['total_sentences_read'],
                'totalSentencesMarked': a['total_sentences_marked'],
                'vocabularyCoverage': a['vocabulary_coverage'],
                'sentenceComprehension': a['sentence_comprehension'],
                'testPassages': passage_list
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reading_bp.route('/reading/statistics', methods=['GET'])
def get_reading_statistics():
    """
    Get reading assessment statistics for charts and progress tracking.
    
    Query Parameters:
        window: 'last_10', 'last_30', or 'all_time'
    
    Returns:
        Statistics object with summary, score trend, and weakness evolution
    """
    try:
        window = request.args.get('window', 'last_10')
        
        with get_db() as conn:
            # Build query based on time window
            if window == 'last_10':
                assessments = conn.execute('''
                    SELECT * FROM reading_assessments
                    ORDER BY taken_at DESC
                    LIMIT 10
                ''').fetchall()
            elif window == 'last_30':
                thirty_days_ago = int(time.time() * 1000) - (30 * 24 * 60 * 60 * 1000)
                assessments = conn.execute('''
                    SELECT * FROM reading_assessments
                    WHERE taken_at >= ?
                    ORDER BY taken_at DESC
                ''', (thirty_days_ago,)).fetchall()
            else:  # all_time
                assessments = conn.execute('''
                    SELECT * FROM reading_assessments
                    ORDER BY taken_at DESC
                ''').fetchall()
            
            if not assessments:
                return jsonify({
                    'summary': {
                        'totalTests': 0,
                        'avgVocabCoverage': 0,
                        'avgComprehension': 0,
                        'currentLevel': 0,
                        'bestVocabCoverage': 0,
                        'improvementRate': '0%'
                    },
                    'scoreTrend': [],
                    'weaknessEvolution': {},
                    'computedAt': int(time.time() * 1000)
                })
            
            # Convert to list and reverse for chronological order in charts
            assessment_list = [dict(a) for a in assessments]
            assessment_list.reverse()
            
            # Calculate summary stats
            total_tests = len(assessment_list)
            vocab_coverages = [a['vocabulary_coverage'] for a in assessment_list]
            comprehensions = [a['sentence_comprehension'] for a in assessment_list]
            
            avg_vocab = sum(vocab_coverages) / total_tests if total_tests > 0 else 0
            avg_comprehension = sum(comprehensions) / total_tests if total_tests > 0 else 0
            current_level = assessment_list[-1]['overall_level'] if assessment_list else 0
            best_vocab = max(vocab_coverages) if vocab_coverages else 0
            
            # Calculate improvement rate (compare first half to second half)
            if total_tests >= 2:
                first_half = assessment_list[:total_tests // 2]
                second_half = assessment_list[total_tests // 2:]
                first_avg = sum(a['vocabulary_coverage'] for a in first_half) / len(first_half)
                second_avg = sum(a['vocabulary_coverage'] for a in second_half) / len(second_half)
                improvement = second_avg - first_avg
                improvement_rate = f"+{improvement:.1f}%" if improvement >= 0 else f"{improvement:.1f}%"
            else:
                improvement_rate = "N/A"
            
            # Build score trend data
            score_trend = []
            for i, a in enumerate(assessment_list):
                score_trend.append({
                    'testNumber': i + 1,
                    'date': a['taken_at'],
                    'vocabularyCoverage': a['vocabulary_coverage'],
                    'sentenceComprehension': a['sentence_comprehension'],
                    'overallLevel': a['overall_level']
                })
            
            # Build weakness evolution (track vocabulary vs grammar barriers)
            weakness_evolution = {
                'vocabulary': [],
                'grammar': []
            }
            
            for a in assessment_list:
                # Count issues per test
                vocab_issues = a['total_words_marked']
                grammar_issues = a['total_sentences_marked']
                
                weakness_evolution['vocabulary'].append(vocab_issues)
                weakness_evolution['grammar'].append(grammar_issues)
            
            return jsonify({
                'summary': {
                    'totalTests': total_tests,
                    'avgVocabCoverage': avg_vocab,
                    'avgComprehension': avg_comprehension,
                    'currentLevel': current_level,
                    'bestVocabCoverage': best_vocab,
                    'improvementRate': improvement_rate
                },
                'scoreTrend': score_trend,
                'weaknessEvolution': weakness_evolution,
                'computedAt': int(time.time() * 1000)
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
