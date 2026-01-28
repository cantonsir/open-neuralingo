"""
Assessment Routes

Handles user assessment profiles and mini-test results.
"""

import json
import time
import uuid
from flask import Blueprint, request, jsonify

from app.database import get_db


assessment_bp = Blueprint('assessment', __name__)


@assessment_bp.route('/assessment/profile', methods=['GET'])
def get_assessment_profile():
    """
    Get the user's latest assessment profile.
    
    Returns:
        Assessment profile object or null
    """
    try:
        with get_db() as conn:
            profile = conn.execute('''
                SELECT * FROM assessment_profiles 
                ORDER BY updated_at DESC LIMIT 1
            ''').fetchone()
            
            if not profile:
                return jsonify(None)
                
            p = dict(profile)
            return jsonify({
                'id': p['id'],
                'targetLanguage': p['target_language'],
                'targetContent': p['target_content'],
                'listeningLevel': p['listening_level'],
                'subtitleDependence': p['subtitle_dependence'],
                'difficulties': json.loads(p['difficulties']) if p['difficulties'] else [],
                'updatedAt': p['updated_at']
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@assessment_bp.route('/assessment/profile', methods=['POST'])
def save_assessment_profile():
    """
    Create or update assessment profile.
    
    Request Body:
        targetLanguage, targetContent, listeningLevel,
        subtitleDependence, difficulties, completedAt
    
    Returns:
        Created profile ID
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    try:
        with get_db() as conn:
            profile_id = str(uuid.uuid4())
            timestamp = int(data.get('completedAt', 0)) or int(time.time() * 1000)
            
            conn.execute('''
                INSERT INTO assessment_profiles 
                (id, target_language, target_content, listening_level, 
                 subtitle_dependence, difficulties, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                profile_id,
                data.get('targetLanguage', 'en'),
                data.get('targetContent', 'general'),
                data.get('listeningLevel', 2),
                data.get('subtitleDependence', 1),
                json.dumps(data.get('difficulties', [])),
                timestamp,
                timestamp
            ))
            
            conn.commit()
            
            return jsonify({'status': 'success', 'id': profile_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@assessment_bp.route('/assessment/results', methods=['GET'])
def get_assessment_results():
    """
    Get mini-test results with optional pagination.

    Query Parameters:
        limit: Number of results to return (default: 5 for backward compatibility)
        offset: Number of results to skip (default: 0)

    Returns:
        Array of test results with details
    """
    try:
        # Get pagination parameters
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', default=0, type=int)

        with get_db() as conn:
            # Build query with optional limit
            query = 'SELECT * FROM mini_test_results ORDER BY taken_at DESC'
            params = []

            if limit is not None:
                query += ' LIMIT ? OFFSET ?'
                params.extend([limit, offset])
            else:
                # Default behavior for backward compatibility
                query += ' LIMIT 5'

            results = conn.execute(query, params if params else None).fetchall()
            
            if not results:
                return jsonify([])

            output_list = []
            for res in results:
                r = dict(res)
                
                details = conn.execute('''
                    SELECT * FROM mini_test_details 
                    WHERE result_id = ? 
                    ORDER BY question_index
                ''', (r['id'],)).fetchall()
                
                test_responses = [
                    {
                        'sentenceId': dict(d)['question_index'],
                        'sentence': dict(d)['sentence'],
                        'understood': bool(dict(d)['understood']),
                        'replays': dict(d)['replays'],
                        'reactionTimeMs': dict(d)['reaction_time_ms'],
                        'markedIndices': json.loads(dict(d)['marked_indices']) if dict(d)['marked_indices'] else []
                    }
                    for d in details
                ]

                analysis = json.loads(r['analysis_json']) if r['analysis_json'] else None
                
                output_list.append({
                    'id': r['id'],
                    'takenAt': r['taken_at'],
                    'score': r['score'],
                    'totalQuestions': r['total_questions'],
                    'analysis': analysis,
                    'responses': test_responses
                })
                
            return jsonify(output_list)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@assessment_bp.route('/assessment/results', methods=['POST'])
def save_assessment_result():
    """
    Save a full test result with details.
    
    Request Body:
        responses: Array of response objects
        analysis: AI analysis object
    
    Returns:
        Created result ID
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    responses = data.get('responses', [])
    analysis = data.get('analysis', {})
    
    if not responses:
        return jsonify({'error': 'No responses provided'}), 400
        
    try:
        with get_db() as conn:
            result_id = str(uuid.uuid4())
            taken_at = int(time.time() * 1000)
            
            total_questions = len(responses)
            score = sum(1 for r in responses if r.get('understood', False))
            
            conn.execute('''
                INSERT INTO mini_test_results 
                (id, taken_at, score, total_questions, analysis_json)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                result_id,
                taken_at,
                score,
                total_questions,
                json.dumps(analysis)
            ))
            
            # Insert details
            for i, resp in enumerate(responses):
                conn.execute('''
                    INSERT INTO mini_test_details
                    (id, result_id, question_index, sentence, understood, 
                     replays, reaction_time_ms, marked_indices)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    str(uuid.uuid4()),
                    result_id,
                    i,
                    resp.get('sentence', ''),
                    resp.get('understood', False),
                    resp.get('replays', 0),
                    resp.get('reactionTimeMs', 0),
                    json.dumps(resp.get('markedIndices', []))
                ))
                
            conn.commit()
            
            return jsonify({'status': 'success', 'id': result_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
