"""
Assessment Statistics Routes

Provides statistical analysis and learning curve data for assessment results.
"""

import json
import time
import uuid
from typing import List, Dict, Any
from flask import Blueprint, request, jsonify

from app.database import get_db


assessment_stats_bp = Blueprint('assessment_stats', __name__)


def get_cached_stats(time_window: str) -> Dict[str, Any] | None:
    """
    Retrieve cached statistics if available and fresh.

    Args:
        time_window: 'last_10', 'last_30', or 'all_time'

    Returns:
        Cached stats or None
    """
    try:
        with get_db() as conn:
            cached = conn.execute('''
                SELECT * FROM assessment_analytics
                WHERE time_window = ?
                ORDER BY computed_at DESC LIMIT 1
            ''', (time_window,)).fetchone()

            if not cached:
                return None

            c = dict(cached)
            return json.loads(c['stats_json']) if c['stats_json'] else None
    except Exception:
        return None


def is_cache_fresh(cached_stats: Dict[str, Any], max_age_seconds: int = 300) -> bool:
    """
    Check if cached statistics are still fresh.

    Args:
        cached_stats: Cached statistics dictionary
        max_age_seconds: Maximum age in seconds (default: 5 minutes)

    Returns:
        True if cache is fresh, False otherwise
    """
    if not cached_stats or 'computedAt' not in cached_stats:
        return False

    current_time = int(time.time() * 1000)
    cached_time = cached_stats['computedAt']
    age_ms = current_time - cached_time

    return age_ms < (max_age_seconds * 1000)


def cache_statistics(time_window: str, stats: Dict[str, Any]) -> None:
    """
    Save computed statistics to cache.

    Args:
        time_window: 'last_10', 'last_30', or 'all_time'
        stats: Statistics dictionary to cache
    """
    try:
        with get_db() as conn:
            cache_id = str(uuid.uuid4())
            computed_at = int(time.time() * 1000)

            conn.execute('''
                INSERT INTO assessment_analytics
                (id, computed_at, time_window, total_tests,
                 score_data_json, weakness_data_json, stats_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                cache_id,
                computed_at,
                time_window,
                stats['summary']['totalTests'],
                json.dumps(stats['scoreTrend']),
                json.dumps(stats.get('weaknessEvolution', {})),
                json.dumps(stats)
            ))

            conn.commit()
    except Exception as e:
        print(f"Failed to cache statistics: {e}")


def compute_statistics(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute comprehensive statistics from test results.

    Args:
        results: List of test result dictionaries

    Returns:
        Statistics dictionary with summary, trends, and weakness data
    """
    if not results:
        return {
            'summary': {
                'totalTests': 0,
                'avgScore': 0.0,
                'bestScore': 0,
                'improvementRate': '+0%'
            },
            'scoreTrend': [],
            'weaknessEvolution': {}
        }

    # Calculate summary statistics
    total_tests = len(results)
    scores = [r['score'] for r in results]
    total_questions = results[0]['totalQuestions'] if results else 10

    avg_score = sum(scores) / len(scores) if scores else 0
    avg_score_percentage = (avg_score / total_questions) * 100 if total_questions > 0 else 0
    best_score = max(scores) if scores else 0

    # Calculate improvement rate (compare first half vs second half)
    improvement_rate = '+0%'
    if len(scores) >= 4:
        mid = len(scores) // 2
        first_half_avg = sum(scores[:mid]) / mid
        second_half_avg = sum(scores[mid:]) / (len(scores) - mid)

        if first_half_avg > 0:
            improvement_pct = ((second_half_avg - first_half_avg) / first_half_avg) * 100
            sign = '+' if improvement_pct >= 0 else ''
            improvement_rate = f"{sign}{improvement_pct:.0f}%"

    # Build score trend data
    score_trend = []
    for i, result in enumerate(reversed(results)):  # Reverse to show oldest first
        score_trend.append({
            'testNumber': i + 1,
            'date': result['takenAt'],
            'score': result['score'],
            'replays': sum(r.get('replays', 0) for r in result.get('responses', [])),
            'reactionTime': sum(r.get('reactionTimeMs', 0) for r in result.get('responses', [])) / total_questions if total_questions > 0 else 0
        })

    # Analyze weakness evolution
    weakness_evolution = analyze_weakness_evolution(results)

    stats = {
        'summary': {
            'totalTests': total_tests,
            'avgScore': round(avg_score_percentage, 1),
            'bestScore': best_score,
            'improvementRate': improvement_rate
        },
        'scoreTrend': score_trend,
        'weaknessEvolution': weakness_evolution,
        'computedAt': int(time.time() * 1000)
    }

    return stats


def analyze_weakness_evolution(results: List[Dict[str, Any]]) -> Dict[str, List[int]]:
    """
    Analyze how weaknesses evolve over time.

    Args:
        results: List of test result dictionaries (ordered by date DESC)

    Returns:
        Dictionary mapping weakness types to frequency arrays
    """
    if not results:
        return {}

    # Common weakness keywords to track
    weakness_keywords = {
        'vocabulary': ['vocabulary', 'vocab', 'word', 'words', 'unfamiliar'],
        'speed': ['speed', 'fast', 'quick', 'pace', 'rapid'],
        'linking': ['linking', 'connected', 'blending', 'weak form', 'reduction'],
        'accent': ['accent', 'pronunciation', 'dialect', 'native speaker'],
        'noise': ['noise', 'background', 'clarity', 'audio quality'],
        'comprehension': ['understand', 'comprehension', 'meaning', 'context']
    }

    # Initialize counters for each weakness type
    weakness_counts = {key: [] for key in weakness_keywords.keys()}

    # Analyze each test result (oldest to newest after reversal)
    for result in reversed(results):
        analysis = result.get('analysis')

        # Count weakness occurrences for this test
        test_weaknesses = {key: 0 for key in weakness_keywords.keys()}

        if analysis and isinstance(analysis, dict):
            weaknesses_list = analysis.get('weaknesses', [])

            if isinstance(weaknesses_list, list):
                # Check each weakness mention
                for weakness_text in weaknesses_list:
                    if isinstance(weakness_text, str):
                        weakness_lower = weakness_text.lower()

                        # Check which weakness types are mentioned
                        for weakness_type, keywords in weakness_keywords.items():
                            if any(keyword in weakness_lower for keyword in keywords):
                                test_weaknesses[weakness_type] += 1

        # Add counts to evolution arrays
        for weakness_type in weakness_keywords.keys():
            weakness_counts[weakness_type].append(test_weaknesses[weakness_type])

    # Filter out weakness types that never appear
    filtered_evolution = {
        weakness_type: counts
        for weakness_type, counts in weakness_counts.items()
        if sum(counts) > 0
    }

    return filtered_evolution


@assessment_stats_bp.route('/assessment/statistics', methods=['GET'])
def get_assessment_statistics():
    """
    Get statistical analysis of assessment results.

    Query Parameters:
        window: 'last_10' (default), 'last_30', or 'all_time'

    Returns:
        Statistics object with summary, score trends, and weakness evolution
    """
    window = request.args.get('window', 'last_10')

    if window not in ['last_10', 'last_30', 'all_time']:
        return jsonify({'error': 'Invalid window parameter'}), 400

    try:
        # Check cache first
        cached = get_cached_stats(window)
        if cached and is_cache_fresh(cached, max_age=300):  # 5 minutes
            return jsonify(cached)

        # Fetch results based on window
        with get_db() as conn:
            if window == 'last_10':
                results_query = '''
                    SELECT * FROM mini_test_results
                    ORDER BY taken_at DESC LIMIT 10
                '''
                results_raw = conn.execute(results_query).fetchall()
            elif window == 'last_30':
                # Last 30 days
                thirty_days_ago = int(time.time() * 1000) - (30 * 24 * 60 * 60 * 1000)
                results_query = '''
                    SELECT * FROM mini_test_results
                    WHERE taken_at >= ?
                    ORDER BY taken_at DESC
                '''
                results_raw = conn.execute(results_query, (thirty_days_ago,)).fetchall()
            else:  # all_time
                results_query = '''
                    SELECT * FROM mini_test_results
                    ORDER BY taken_at DESC
                '''
                results_raw = conn.execute(results_query).fetchall()

            if not results_raw:
                return jsonify({
                    'summary': {
                        'totalTests': 0,
                        'avgScore': 0.0,
                        'bestScore': 0,
                        'improvementRate': '+0%'
                    },
                    'scoreTrend': [],
                    'weaknessEvolution': {}
                })

            # Convert to dictionaries with responses
            results = []
            for res in results_raw:
                r = dict(res)

                # Fetch responses for each result
                details = conn.execute('''
                    SELECT * FROM mini_test_details
                    WHERE result_id = ?
                    ORDER BY question_index
                ''', (r['id'],)).fetchall()

                responses = [
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

                results.append({
                    'id': r['id'],
                    'takenAt': r['taken_at'],
                    'score': r['score'],
                    'totalQuestions': r['total_questions'],
                    'analysis': json.loads(r['analysis_json']) if r['analysis_json'] else None,
                    'responses': responses
                })

            # Compute statistics
            stats = compute_statistics(results)

            # Cache the results
            cache_statistics(window, stats)

            return jsonify(stats)

    except Exception as e:
        return jsonify({'error': str(e)}), 500
