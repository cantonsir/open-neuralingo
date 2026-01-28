"""
Flashcards Routes

Handles CRUD operations for flashcards/markers.
Supports module-specific tables: listening, speaking, reading, writing.
Implements Anki-style Spaced Repetition with learning queue.
"""

import json
import time
from datetime import date, timedelta
from flask import Blueprint, request, jsonify

from app.database import get_db


flashcards_bp = Blueprint('flashcards', __name__)


# ============ Anki-Style SRS Constants ============

# Learning steps in seconds (1 min, 10 min)
LEARNING_STEPS = [60, 600]

# Relearning steps in seconds (10 min)
RELEARNING_STEPS = [600]

# Hard multiplier (Hard interval = current step * this)
HARD_MULTIPLIER = 2.0  # Hard = 2x current step (1m -> 2m, 10m -> 20m)

# Graduating intervals in days
GRADUATING_INTERVAL_GOOD = 1  # When graduating from learning with Good
GRADUATING_INTERVAL_EASY = 4  # When graduating with Easy (or Easy on new card)

# Lapse settings
LAPSE_NEW_INTERVAL_PERCENT = 0.7  # Multiply old interval by this on lapse
LAPSE_MINIMUM_INTERVAL = 1  # Minimum interval after lapse (days)

# SM-2 parameters
MINIMUM_EASE_FACTOR = 1.3
STARTING_EASE_FACTOR = 2.5
EASY_BONUS = 1.3  # Multiply interval by this for Easy answer

# Card states
CARD_STATE_NEW = 'new'
CARD_STATE_LEARNING = 'learning'
CARD_STATE_REVIEW = 'review'
CARD_STATE_RELEARNING = 'relearning'

# Valid modules and their corresponding tables
VALID_MODULES = ['listening', 'speaking', 'reading', 'writing']


# ============ Helper Functions ============

def _get_table_name(module: str) -> str:
    """Get the table name for a module."""
    if module not in VALID_MODULES:
        raise ValueError(f"Invalid module: {module}")
    return f"{module}_flashcards"


def _parse_json_field(value, default):
    """Safely parse a JSON field with a default fallback."""
    if not value:
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def _get_current_timestamp_ms() -> int:
    """Get current Unix timestamp in milliseconds."""
    return int(time.time() * 1000)


def _card_to_marker(card: dict) -> dict:
    """Convert a database card record to frontend Marker format."""
    return {
        'id': card['id'],
        'videoId': card['video_id'],
        'start': card['start_time'],
        'end': card['end_time'],
        'subtitleText': card['subtitle_text'],
        'createdAt': card['created_at'],
        'vocabData': _parse_json_field(card['vocab_data'], {}),
        'misunderstoodIndices': _parse_json_field(card['misunderstood_indices'], []),
        'tags': _parse_json_field(card['tags'], []),
        'note': card['note'],
        'pressCount': card['press_count'],
        'source': card.get('source'),
        # SM-2 SRS fields
        'easeFactor': card.get('ease_factor') or STARTING_EASE_FACTOR,
        'interval': card.get('interval_days') or 0,
        'repetitions': card.get('repetitions') or 0,
        'nextReviewDate': card.get('next_review_date'),
        'lastReviewedAt': card.get('last_reviewed_at'),
        'customTags': _parse_json_field(card.get('custom_tags'), []),
        # Anki-style card state fields
        'cardState': card.get('card_state') or CARD_STATE_NEW,
        'learningStep': card.get('learning_step') or 0,
        'dueTimestamp': card.get('due_timestamp'),
    }


def format_interval_display(seconds: int = None, days: int = None) -> str:
    """
    Format interval for human-readable display.
    Can accept either seconds (for learning cards) or days (for review cards).
    """
    if seconds is not None:
        if seconds < 60:
            return f"{seconds}s"
        elif seconds < 3600:
            mins = seconds // 60
            return f"{mins}m"
        elif seconds < 86400:
            hours = seconds // 3600
            return f"{hours}h"
        else:
            days = seconds // 86400
            # Fall through to days display
    
    if days is not None:
        if days == 0:
            return "<1m"
        elif days == 1:
            return "1d"
        elif days < 7:
            return f"{days}d"
        elif days < 30:
            weeks = days // 7
            return f"{weeks}w"
        elif days < 365:
            months = days // 30
            return f"{months}mo"
        else:
            years = days // 365
            return f"{years}y"
    
    return "<1m"


def calculate_sm2_interval(quality: int, repetitions: int, ease_factor: float, interval: int) -> tuple:
    """
    SM-2 algorithm for calculating next interval for REVIEW cards.
    
    Args:
        quality: Rating 1-4 (Again=1, Hard=2, Good=3, Easy=4)
        repetitions: Number of consecutive correct recalls
        ease_factor: Current easiness factor (minimum 1.3)
        interval: Current interval in days
    
    Returns:
        tuple: (new_interval_days, new_ease_factor, new_repetitions)
    """
    if quality == 1:  # Again - lapse
        new_interval = max(LAPSE_MINIMUM_INTERVAL, int(interval * LAPSE_NEW_INTERVAL_PERCENT))
        new_ef = max(MINIMUM_EASE_FACTOR, ease_factor - 0.2)
        new_reps = 0
    elif quality == 2:  # Hard
        new_interval = max(1, int(interval * 1.2))
        new_ef = max(MINIMUM_EASE_FACTOR, ease_factor - 0.15)
        new_reps = repetitions + 1
    elif quality == 3:  # Good
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = int(interval * ease_factor)
        new_ef = ease_factor
        new_reps = repetitions + 1
    else:  # Easy (quality == 4)
        if repetitions == 0:
            new_interval = GRADUATING_INTERVAL_EASY
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = int(interval * ease_factor * EASY_BONUS)
        new_ef = ease_factor + 0.15
        new_reps = repetitions + 1
    
    return new_interval, new_ef, new_reps


def get_next_review_date(interval_days: int) -> str:
    """Calculate the next review date as ISO string."""
    return (date.today() + timedelta(days=interval_days)).isoformat()


# ============ Card State Machine ============

def process_review(card: dict, rating: str) -> dict:
    """
    Process a review and return the updated card fields.
    
    This is the core Anki-style state machine.
    
    Args:
        card: Current card data from database
        rating: One of 'again', 'hard', 'good', 'easy'
    
    Returns:
        dict with updated fields: card_state, learning_step, due_timestamp,
        ease_factor, interval_days, repetitions, next_review_date, last_reviewed_at
    """
    now_ms = _get_current_timestamp_ms()
    card_state = card.get('card_state') or CARD_STATE_NEW
    learning_step = card.get('learning_step') or 0
    ease_factor = card.get('ease_factor') or STARTING_EASE_FACTOR
    interval_days = card.get('interval_days') or 0
    repetitions = card.get('repetitions') or 0
    
    result = {
        'last_reviewed_at': now_ms,
    }
    
    if card_state == CARD_STATE_NEW:
        # NEW card - first review ever
        if rating == 'again':
            # Move to learning, step 0, with base interval
            result['card_state'] = CARD_STATE_LEARNING
            result['learning_step'] = 0
            result['due_timestamp'] = now_ms + (LEARNING_STEPS[0] * 1000)
            result['ease_factor'] = ease_factor
            result['interval_days'] = 0
            result['repetitions'] = 0
            result['next_review_date'] = None
        elif rating == 'hard':
            # Move to learning, step 0, with longer interval (1.5x)
            hard_interval = int(LEARNING_STEPS[0] * HARD_MULTIPLIER)
            result['card_state'] = CARD_STATE_LEARNING
            result['learning_step'] = 0
            result['due_timestamp'] = now_ms + (hard_interval * 1000)
            result['ease_factor'] = ease_factor
            result['interval_days'] = 0
            result['repetitions'] = 0
            result['next_review_date'] = None
        elif rating == 'good':
            # Move to learning, step 0
            result['card_state'] = CARD_STATE_LEARNING
            result['learning_step'] = 0
            result['due_timestamp'] = now_ms + (LEARNING_STEPS[0] * 1000)
            result['ease_factor'] = ease_factor
            result['interval_days'] = 0
            result['repetitions'] = 0
            result['next_review_date'] = None
        else:  # easy
            # Graduate immediately to review with 4-day interval
            result['card_state'] = CARD_STATE_REVIEW
            result['learning_step'] = 0
            result['due_timestamp'] = None
            result['ease_factor'] = ease_factor + 0.15
            result['interval_days'] = GRADUATING_INTERVAL_EASY
            result['repetitions'] = 1
            result['next_review_date'] = get_next_review_date(GRADUATING_INTERVAL_EASY)
    
    elif card_state == CARD_STATE_LEARNING:
        # LEARNING card
        if rating == 'again':
            # Reset to step 0
            result['card_state'] = CARD_STATE_LEARNING
            result['learning_step'] = 0
            result['due_timestamp'] = now_ms + (LEARNING_STEPS[0] * 1000)
            result['ease_factor'] = max(MINIMUM_EASE_FACTOR, ease_factor - 0.2)
            result['interval_days'] = 0
            result['repetitions'] = 0
            result['next_review_date'] = None
        elif rating == 'hard':
            # Stay at current step, but with longer interval (1.5x)
            current_step = min(learning_step, len(LEARNING_STEPS) - 1)
            hard_interval = int(LEARNING_STEPS[current_step] * HARD_MULTIPLIER)
            result['card_state'] = CARD_STATE_LEARNING
            result['learning_step'] = current_step
            result['due_timestamp'] = now_ms + (hard_interval * 1000)
            result['ease_factor'] = max(MINIMUM_EASE_FACTOR, ease_factor - 0.15)
            result['interval_days'] = 0
            result['repetitions'] = repetitions
            result['next_review_date'] = None
        elif rating == 'good':
            # Advance to next step or graduate
            next_step = learning_step + 1
            if next_step >= len(LEARNING_STEPS):
                # Graduate to review
                result['card_state'] = CARD_STATE_REVIEW
                result['learning_step'] = 0
                result['due_timestamp'] = None
                result['ease_factor'] = ease_factor
                result['interval_days'] = GRADUATING_INTERVAL_GOOD
                result['repetitions'] = 1
                result['next_review_date'] = get_next_review_date(GRADUATING_INTERVAL_GOOD)
            else:
                # Move to next learning step
                result['card_state'] = CARD_STATE_LEARNING
                result['learning_step'] = next_step
                result['due_timestamp'] = now_ms + (LEARNING_STEPS[next_step] * 1000)
                result['ease_factor'] = ease_factor
                result['interval_days'] = 0
                result['repetitions'] = repetitions
                result['next_review_date'] = None
        else:  # easy
            # Graduate immediately with bonus interval
            result['card_state'] = CARD_STATE_REVIEW
            result['learning_step'] = 0
            result['due_timestamp'] = None
            result['ease_factor'] = ease_factor + 0.15
            result['interval_days'] = GRADUATING_INTERVAL_EASY
            result['repetitions'] = 1
            result['next_review_date'] = get_next_review_date(GRADUATING_INTERVAL_EASY)
    
    elif card_state == CARD_STATE_REVIEW:
        # REVIEW card - use SM-2 for intervals
        quality_map = {'again': 1, 'hard': 2, 'good': 3, 'easy': 4}
        quality = quality_map.get(rating, 3)
        
        if rating == 'again':
            # Lapse - move to relearning
            new_interval = max(LAPSE_MINIMUM_INTERVAL, int(interval_days * LAPSE_NEW_INTERVAL_PERCENT))
            result['card_state'] = CARD_STATE_RELEARNING
            result['learning_step'] = 0
            result['due_timestamp'] = now_ms + (RELEARNING_STEPS[0] * 1000)
            result['ease_factor'] = max(MINIMUM_EASE_FACTOR, ease_factor - 0.2)
            result['interval_days'] = new_interval  # Store for after relearning
            result['repetitions'] = 0
            result['next_review_date'] = None
        else:
            # Calculate new interval using SM-2
            new_interval, new_ef, new_reps = calculate_sm2_interval(
                quality, repetitions, ease_factor, interval_days
            )
            result['card_state'] = CARD_STATE_REVIEW
            result['learning_step'] = 0
            result['due_timestamp'] = None
            result['ease_factor'] = new_ef
            result['interval_days'] = new_interval
            result['repetitions'] = new_reps
            result['next_review_date'] = get_next_review_date(new_interval)
    
    elif card_state == CARD_STATE_RELEARNING:
        # RELEARNING card (after a lapse)
        if rating == 'again':
            # Reset to step 0
            result['card_state'] = CARD_STATE_RELEARNING
            result['learning_step'] = 0
            result['due_timestamp'] = now_ms + (RELEARNING_STEPS[0] * 1000)
            result['ease_factor'] = max(MINIMUM_EASE_FACTOR, ease_factor - 0.2)
            result['interval_days'] = interval_days  # Keep stored interval
            result['repetitions'] = 0
            result['next_review_date'] = None
        elif rating == 'hard':
            # Stay at current step, but with longer interval (1.5x)
            current_step = min(learning_step, len(RELEARNING_STEPS) - 1)
            hard_interval = int(RELEARNING_STEPS[current_step] * HARD_MULTIPLIER)
            result['card_state'] = CARD_STATE_RELEARNING
            result['learning_step'] = current_step
            result['due_timestamp'] = now_ms + (hard_interval * 1000)
            result['ease_factor'] = max(MINIMUM_EASE_FACTOR, ease_factor - 0.15)
            result['interval_days'] = interval_days
            result['repetitions'] = repetitions
            result['next_review_date'] = None
        elif rating == 'good':
            # Advance or graduate back to review
            next_step = learning_step + 1
            if next_step >= len(RELEARNING_STEPS):
                # Graduate back to review with stored interval
                result['card_state'] = CARD_STATE_REVIEW
                result['learning_step'] = 0
                result['due_timestamp'] = None
                result['ease_factor'] = ease_factor
                result['interval_days'] = interval_days
                result['repetitions'] = 1
                result['next_review_date'] = get_next_review_date(interval_days)
            else:
                # Move to next relearning step
                result['card_state'] = CARD_STATE_RELEARNING
                result['learning_step'] = next_step
                result['due_timestamp'] = now_ms + (RELEARNING_STEPS[next_step] * 1000)
                result['ease_factor'] = ease_factor
                result['interval_days'] = interval_days
                result['repetitions'] = repetitions
                result['next_review_date'] = None
        else:  # easy
            # Graduate immediately back to review with bonus
            bonus_interval = max(interval_days, GRADUATING_INTERVAL_EASY)
            result['card_state'] = CARD_STATE_REVIEW
            result['learning_step'] = 0
            result['due_timestamp'] = None
            result['ease_factor'] = ease_factor + 0.15
            result['interval_days'] = bonus_interval
            result['repetitions'] = 1
            result['next_review_date'] = get_next_review_date(bonus_interval)
    
    return result


def get_preview_intervals(card: dict) -> dict:
    """
    Get preview intervals for each rating button.
    
    Returns dict with 'again', 'hard', 'good', 'easy' keys,
    each containing 'display' (human readable) and 'seconds' or 'days'.
    """
    card_state = card.get('card_state') or CARD_STATE_NEW
    learning_step = card.get('learning_step') or 0
    ease_factor = card.get('ease_factor') or STARTING_EASE_FACTOR
    interval_days = card.get('interval_days') or 0
    repetitions = card.get('repetitions') or 0
    
    intervals = {}
    
    if card_state == CARD_STATE_NEW:
        hard_interval = int(LEARNING_STEPS[0] * HARD_MULTIPLIER)
        intervals['again'] = {'seconds': LEARNING_STEPS[0], 'display': format_interval_display(seconds=LEARNING_STEPS[0])}
        intervals['hard'] = {'seconds': hard_interval, 'display': format_interval_display(seconds=hard_interval)}
        intervals['good'] = {'seconds': LEARNING_STEPS[0], 'display': format_interval_display(seconds=LEARNING_STEPS[0])}
        intervals['easy'] = {'days': GRADUATING_INTERVAL_EASY, 'display': format_interval_display(days=GRADUATING_INTERVAL_EASY)}
    
    elif card_state == CARD_STATE_LEARNING:
        current_step = min(learning_step, len(LEARNING_STEPS) - 1)
        next_step = learning_step + 1
        hard_interval = int(LEARNING_STEPS[current_step] * HARD_MULTIPLIER)
        
        intervals['again'] = {'seconds': LEARNING_STEPS[0], 'display': format_interval_display(seconds=LEARNING_STEPS[0])}
        intervals['hard'] = {'seconds': hard_interval, 'display': format_interval_display(seconds=hard_interval)}
        
        if next_step >= len(LEARNING_STEPS):
            intervals['good'] = {'days': GRADUATING_INTERVAL_GOOD, 'display': format_interval_display(days=GRADUATING_INTERVAL_GOOD)}
        else:
            intervals['good'] = {'seconds': LEARNING_STEPS[next_step], 'display': format_interval_display(seconds=LEARNING_STEPS[next_step])}
        
        intervals['easy'] = {'days': GRADUATING_INTERVAL_EASY, 'display': format_interval_display(days=GRADUATING_INTERVAL_EASY)}
    
    elif card_state == CARD_STATE_REVIEW:
        # Again -> relearning
        intervals['again'] = {'seconds': RELEARNING_STEPS[0], 'display': format_interval_display(seconds=RELEARNING_STEPS[0])}
        
        # Hard -> shorter interval
        hard_interval = max(1, int(interval_days * 1.2))
        intervals['hard'] = {'days': hard_interval, 'display': format_interval_display(days=hard_interval)}
        
        # Good -> SM-2 interval
        if repetitions == 0:
            good_interval = 1
        elif repetitions == 1:
            good_interval = 6
        else:
            good_interval = int(interval_days * ease_factor)
        intervals['good'] = {'days': good_interval, 'display': format_interval_display(days=good_interval)}
        
        # Easy -> bonus interval
        if repetitions == 0:
            easy_interval = GRADUATING_INTERVAL_EASY
        elif repetitions == 1:
            easy_interval = 6
        else:
            easy_interval = int(interval_days * ease_factor * EASY_BONUS)
        intervals['easy'] = {'days': easy_interval, 'display': format_interval_display(days=easy_interval)}
    
    elif card_state == CARD_STATE_RELEARNING:
        current_step = min(learning_step, len(RELEARNING_STEPS) - 1)
        next_step = learning_step + 1
        hard_interval = int(RELEARNING_STEPS[current_step] * HARD_MULTIPLIER)
        
        intervals['again'] = {'seconds': RELEARNING_STEPS[0], 'display': format_interval_display(seconds=RELEARNING_STEPS[0])}
        intervals['hard'] = {'seconds': hard_interval, 'display': format_interval_display(seconds=hard_interval)}
        
        if next_step >= len(RELEARNING_STEPS):
            # Graduate back with stored interval
            intervals['good'] = {'days': interval_days, 'display': format_interval_display(days=interval_days)}
        else:
            intervals['good'] = {'seconds': RELEARNING_STEPS[next_step], 'display': format_interval_display(seconds=RELEARNING_STEPS[next_step])}
        
        bonus_interval = max(interval_days, GRADUATING_INTERVAL_EASY)
        intervals['easy'] = {'days': bonus_interval, 'display': format_interval_display(days=bonus_interval)}
    
    return intervals


# ============ Module-specific routes ============

@flashcards_bp.route('/<module>/cards', methods=['GET'])
def get_module_cards(module):
    """
    Get all flashcards for a specific module.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Returns:
        JSON array of all flashcard markers for the module
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            cards = conn.execute(
                f'SELECT * FROM {table_name} ORDER BY created_at DESC'
            ).fetchall()
            
            return jsonify([_card_to_marker(dict(card)) for card in cards])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards', methods=['POST'])
def save_module_card(module):
    """
    Save a new flashcard or update existing one for a specific module.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Request Body:
        id, start, end, subtitleText, createdAt, vocabData, 
        misunderstoodIndices, tags, note, pressCount, videoId, source
    
    Returns:
        Success status with card ID
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    card = request.json
    if not card:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            conn.execute(f'''
                INSERT OR REPLACE INTO {table_name} 
                (id, video_id, start_time, end_time, subtitle_text, created_at, 
                 vocab_data, misunderstood_indices, tags, note, press_count, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                card['id'],
                card.get('videoId', ''),
                card['start'],
                card['end'],
                card.get('subtitleText', ''),
                card['createdAt'],
                json.dumps(card.get('vocabData', {})),
                json.dumps(card.get('misunderstoodIndices', [])),
                json.dumps(card.get('tags', [])),
                card.get('note', ''),
                card.get('pressCount', 0),
                card.get('source', '')
            ))
            conn.commit()
            
            return jsonify({'status': 'success', 'id': card['id']}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/<card_id>', methods=['DELETE'])
def delete_module_card(module, card_id):
    """
    Delete a flashcard by ID for a specific module.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
        card_id: Flashcard ID to delete
    
    Returns:
        Deletion status
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            conn.execute(f'DELETE FROM {table_name} WHERE id = ?', (card_id,))
            conn.commit()
            
            return jsonify({'status': 'deleted'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/<card_id>', methods=['PUT'])
def update_module_card(module, card_id):
    """
    Update specific fields of a flashcard for a specific module.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
        card_id: Flashcard ID to update
    
    Request Body:
        Partial update with any of: vocabData, note, pressCount, misunderstoodIndices
    
    Returns:
        Update status
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    updates = request.json
    if not updates:
        return jsonify({'error': 'No data provided'}), 400

    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            # Build dynamic update query
            fields = []
            values = []
            
            field_mapping = {
                'vocabData': ('vocab_data', lambda v: json.dumps(v)),
                'note': ('note', lambda v: v),
                'pressCount': ('press_count', lambda v: v),
                'misunderstoodIndices': ('misunderstood_indices', lambda v: json.dumps(v))
            }
            
            for key, (db_field, transform) in field_mapping.items():
                if key in updates:
                    fields.append(f'{db_field} = ?')
                    values.append(transform(updates[key]))
            
            if not fields:
                return jsonify({'status': 'no changes'}), 200

            values.append(card_id)
            query = f'UPDATE {table_name} SET {", ".join(fields)} WHERE id = ?'
            
            conn.execute(query, values)
            conn.commit()
            
            return jsonify({'status': 'updated'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ Legacy routes (backward compatibility) ============
# These use the old 'flashcards' table directly

@flashcards_bp.route('/cards', methods=['GET'])
def get_cards():
    """
    Get all flashcards (legacy - uses old flashcards table).
    Kept for backward compatibility.
    
    Returns:
        JSON array of all flashcard markers
    """
    try:
        with get_db() as conn:
            cards = conn.execute(
                'SELECT * FROM flashcards ORDER BY created_at DESC'
            ).fetchall()
            
            return jsonify([_card_to_marker(dict(card)) for card in cards])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/cards', methods=['POST'])
def save_card():
    """
    Save a new flashcard or update existing one (legacy).
    Kept for backward compatibility.
    """
    card = request.json
    if not card:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        with get_db() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO flashcards 
                (id, video_id, start_time, end_time, subtitle_text, created_at, 
                 vocab_data, misunderstood_indices, tags, note, press_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                card['id'],
                card.get('videoId', ''),
                card['start'],
                card['end'],
                card.get('subtitleText', ''),
                card['createdAt'],
                json.dumps(card.get('vocabData', {})),
                json.dumps(card.get('misunderstoodIndices', [])),
                json.dumps(card.get('tags', [])),
                card.get('note', ''),
                card.get('pressCount', 0)
            ))
            conn.commit()
            
            return jsonify({'status': 'success', 'id': card['id']}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/cards/<card_id>', methods=['DELETE'])
def delete_card(card_id):
    """
    Delete a flashcard by ID (legacy).
    Kept for backward compatibility.
    """
    try:
        with get_db() as conn:
            conn.execute('DELETE FROM flashcards WHERE id = ?', (card_id,))
            conn.commit()
            
            return jsonify({'status': 'deleted'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/cards/<card_id>', methods=['PUT'])
def update_card(card_id):
    """
    Update specific fields of a flashcard (legacy).
    Kept for backward compatibility.
    """
    updates = request.json
    if not updates:
        return jsonify({'error': 'No data provided'}), 400

    try:
        with get_db() as conn:
            # Build dynamic update query
            fields = []
            values = []
            
            field_mapping = {
                'vocabData': ('vocab_data', lambda v: json.dumps(v)),
                'note': ('note', lambda v: v),
                'pressCount': ('press_count', lambda v: v),
                'misunderstoodIndices': ('misunderstood_indices', lambda v: json.dumps(v))
            }
            
            for key, (db_field, transform) in field_mapping.items():
                if key in updates:
                    fields.append(f'{db_field} = ?')
                    values.append(transform(updates[key]))
            
            if not fields:
                return jsonify({'status': 'no changes'}), 200

            values.append(card_id)
            query = f'UPDATE flashcards SET {", ".join(fields)} WHERE id = ?'
            
            conn.execute(query, values)
            conn.commit()
            
            return jsonify({'status': 'updated'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ Anki-Style Spaced Repetition Routes ============

@flashcards_bp.route('/<module>/cards/due', methods=['GET'])
def get_due_cards(module):
    """
    Get all flashcards due for review for a specific module.
    
    Includes learning/relearning cards that are due NOW (based on due_timestamp),
    review cards due today, and optionally new cards.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Query Parameters:
        include_new: Include new cards (default: true)
        include_pending: Include learning cards even if not due yet (default: false)
        sort: Sort order - 'due_first', 'random', 'newest', 'oldest' (default: due_first)
        new_limit: Maximum number of new cards to include (default: no limit)
    
    Returns:
        JSON array of cards due for review, prioritized:
        1. Learning/Relearning cards (by due_timestamp)
        2. Review cards (by next_review_date)
        3. New cards (by created_at)
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    include_new = request.args.get('include_new', 'true').lower() == 'true'
    include_pending = request.args.get('include_pending', 'false').lower() == 'true'
    sort_order = request.args.get('sort', 'due_first')
    new_limit = request.args.get('new_limit', type=int)
    
    now_ms = _get_current_timestamp_ms()
    today = date.today().isoformat()
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            all_cards = []
            
            # 1. Get learning/relearning cards
            if include_pending:
                # Include ALL learning/relearning cards (even if not due yet)
                learning_cards = conn.execute(f'''
                    SELECT * FROM {table_name}
                    WHERE card_state IN ('learning', 'relearning')
                    AND due_timestamp IS NOT NULL
                    ORDER BY due_timestamp ASC
                ''').fetchall()
            else:
                # Only get learning/relearning cards that are due (due_timestamp <= now)
                learning_cards = conn.execute(f'''
                    SELECT * FROM {table_name}
                    WHERE card_state IN ('learning', 'relearning')
                    AND due_timestamp IS NOT NULL
                    AND due_timestamp <= ?
                    ORDER BY due_timestamp ASC
                ''', (now_ms,)).fetchall()
            all_cards.extend([dict(c) for c in learning_cards])
            
            # 2. Get review cards that are due today
            review_cards = conn.execute(f'''
                SELECT * FROM {table_name}
                WHERE card_state = 'review'
                AND next_review_date IS NOT NULL
                AND next_review_date <= ?
                ORDER BY next_review_date ASC
            ''', (today,)).fetchall()
            all_cards.extend([dict(c) for c in review_cards])
            
            # 3. Get new cards if requested
            if include_new:
                limit_clause = f'LIMIT {new_limit}' if new_limit else ''
                new_cards = conn.execute(f'''
                    SELECT * FROM {table_name}
                    WHERE card_state = 'new' OR card_state IS NULL
                    ORDER BY created_at ASC
                    {limit_clause}
                ''').fetchall()
                all_cards.extend([dict(c) for c in new_cards])
            
            # Apply sorting
            if sort_order == 'random':
                import random
                random.shuffle(all_cards)
            elif sort_order == 'newest':
                all_cards.sort(key=lambda c: c.get('created_at', ''), reverse=True)
            elif sort_order == 'oldest':
                all_cards.sort(key=lambda c: c.get('created_at', ''))
            # 'due_first' is already handled by the query order (learning -> review -> new)
            
            # Convert to markers and add preview intervals
            result = []
            for card in all_cards:
                marker = _card_to_marker(card)
                marker['previewIntervals'] = get_preview_intervals(card)
                result.append(marker)
            
            return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/<card_id>/review', methods=['POST'])
def submit_review(module, card_id):
    """
    Submit a review result for a flashcard using Anki-style state machine.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
        card_id: Flashcard ID to update
    
    Request Body:
        rating: One of 'again', 'hard', 'good', 'easy'
    
    Returns:
        Updated card with new SRS values and preview intervals for next card
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    data = request.json
    if not data or 'rating' not in data:
        return jsonify({'error': 'rating required (again/hard/good/easy)'}), 400
    
    rating = data['rating'].lower()
    if rating not in ['again', 'hard', 'good', 'easy']:
        return jsonify({'error': 'rating must be one of: again, hard, good, easy'}), 400
    
    try:
        table_name = _get_table_name(module)
        
        with get_db() as conn:
            # Get current card state
            card = conn.execute(
                f'SELECT * FROM {table_name} WHERE id = ?', (card_id,)
            ).fetchone()
            
            if not card:
                return jsonify({'error': 'Card not found'}), 404
            
            card = dict(card)
            
            # Store state before review for logging
            state_before = card.get('card_state') or CARD_STATE_NEW
            interval_before = card.get('interval_days') or 0
            ease_before = card.get('ease_factor') or STARTING_EASE_FACTOR
            
            # Process review using state machine
            updates = process_review(card, rating)
            
            # Update the card in database
            conn.execute(f'''
                UPDATE {table_name} 
                SET card_state = ?,
                    learning_step = ?,
                    due_timestamp = ?,
                    ease_factor = ?,
                    interval_days = ?,
                    repetitions = ?,
                    next_review_date = ?,
                    last_reviewed_at = ?
                WHERE id = ?
            ''', (
                updates['card_state'],
                updates['learning_step'],
                updates.get('due_timestamp'),
                updates['ease_factor'],
                updates['interval_days'],
                updates['repetitions'],
                updates.get('next_review_date'),
                updates['last_reviewed_at'],
                card_id
            ))
            
            # Log the review to review_log table
            conn.execute('''
                INSERT INTO review_log 
                (card_id, module, reviewed_at, rating, 
                 card_state_before, card_state_after,
                 interval_before, interval_after,
                 ease_factor_before, ease_factor_after,
                 time_taken_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                card_id,
                module,
                updates['last_reviewed_at'],
                rating,
                state_before,
                updates['card_state'],
                interval_before,
                updates['interval_days'],
                ease_before,
                updates['ease_factor'],
                data.get('time_taken_ms')  # Optional: frontend can send this
            ))
            
            conn.commit()
            
            # Return updated card
            updated_card = conn.execute(
                f'SELECT * FROM {table_name} WHERE id = ?', (card_id,)
            ).fetchone()
            
            result = _card_to_marker(dict(updated_card))
            result['previewIntervals'] = get_preview_intervals(dict(updated_card))
            
            # Add human-readable interval display
            if updates['card_state'] in [CARD_STATE_LEARNING, CARD_STATE_RELEARNING]:
                # Show time until due
                due_in_seconds = (updates['due_timestamp'] - _get_current_timestamp_ms()) // 1000
                result['intervalDisplay'] = format_interval_display(seconds=max(0, due_in_seconds))
            else:
                result['intervalDisplay'] = format_interval_display(days=updates['interval_days'])
            
            return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/learning-status', methods=['GET'])
def get_learning_status(module):
    """
    Get the status of learning/relearning cards for a module.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Returns:
        JSON object with:
            - learningCount: Number of cards in learning state
            - relearningCount: Number of cards in relearning state
            - pendingCount: Total learning + relearning cards not yet due
            - dueNowCount: Learning/relearning cards due right now
            - nextDueIn: Seconds until next learning card is due (null if none)
            - nextDueTimestamp: Unix ms timestamp of next due card (null if none)
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    now_ms = _get_current_timestamp_ms()
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            # Count learning cards
            learning_count = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name}
                WHERE card_state = 'learning'
            ''').fetchone()[0]
            
            # Count relearning cards
            relearning_count = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name}
                WHERE card_state = 'relearning'
            ''').fetchone()[0]
            
            # Count due now (learning/relearning with due_timestamp <= now)
            due_now = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name}
                WHERE card_state IN ('learning', 'relearning')
                AND due_timestamp IS NOT NULL
                AND due_timestamp <= ?
            ''', (now_ms,)).fetchone()[0]
            
            # Get next due timestamp for pending cards
            next_due = conn.execute(f'''
                SELECT MIN(due_timestamp) FROM {table_name}
                WHERE card_state IN ('learning', 'relearning')
                AND due_timestamp IS NOT NULL
                AND due_timestamp > ?
            ''', (now_ms,)).fetchone()[0]
            
            next_due_in = None
            if next_due:
                next_due_in = max(0, (next_due - now_ms) // 1000)  # seconds
            
            pending_count = learning_count + relearning_count - due_now
            
            return jsonify({
                'learningCount': learning_count,
                'relearningCount': relearning_count,
                'pendingCount': pending_count,
                'dueNowCount': due_now,
                'nextDueIn': next_due_in,
                'nextDueTimestamp': next_due,
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/stats', methods=['GET'])
def get_srs_stats(module):
    """
    Get SRS statistics for a module.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Returns:
        JSON object with statistics:
            - total: Total cards in deck
            - new: Cards in 'new' state
            - learning: Cards in 'learning' or 'relearning' state
            - review: Cards in 'review' state
            - dueToday: Cards due for review today (all types)
            - mastered: Cards with interval >= 21 days
            - averageEaseFactor: Average ease factor
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    today = date.today().isoformat()
    now_ms = _get_current_timestamp_ms()
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            # Total cards
            total = conn.execute(f'SELECT COUNT(*) FROM {table_name}').fetchone()[0]
            
            # New cards
            new_count = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name} 
                WHERE card_state = 'new' OR card_state IS NULL
            ''').fetchone()[0]
            
            # Learning + Relearning cards
            learning = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name} 
                WHERE card_state IN ('learning', 'relearning')
            ''').fetchone()[0]
            
            # Review cards
            review = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name} 
                WHERE card_state = 'review'
            ''').fetchone()[0]
            
            # Due today - learning/relearning cards due now + review cards due today + new cards
            due_learning = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name}
                WHERE card_state IN ('learning', 'relearning')
                AND due_timestamp IS NOT NULL
                AND due_timestamp <= ?
            ''', (now_ms,)).fetchone()[0]
            
            due_review = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name}
                WHERE card_state = 'review'
                AND next_review_date IS NOT NULL
                AND next_review_date <= ?
            ''', (today,)).fetchone()[0]
            
            due_today = due_learning + due_review + new_count
            
            # Mastered (interval >= 21 days)
            mastered = conn.execute(f'''
                SELECT COUNT(*) FROM {table_name} 
                WHERE interval_days >= 21
            ''').fetchone()[0]
            
            # Average ease factor
            avg_ef = conn.execute(f'''
                SELECT AVG(ease_factor) FROM {table_name} 
                WHERE ease_factor IS NOT NULL
            ''').fetchone()[0] or STARTING_EASE_FACTOR
            
            return jsonify({
                'total': total,
                'new': new_count,
                'learning': learning,
                'review': review,
                'dueToday': due_today,
                'mastered': mastered,
                'averageEaseFactor': round(avg_ef, 2)
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/preview-intervals', methods=['POST'])
def preview_intervals_route(module):
    """
    Preview what the next intervals would be for each rating.
    Useful for showing interval times on the review buttons.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Request Body:
        card_id: ID of the card to preview intervals for
    
    Returns:
        JSON object with intervals for each rating (again, hard, good, easy)
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    data = request.json
    if not data or 'card_id' not in data:
        return jsonify({'error': 'card_id required'}), 400
    
    card_id = data['card_id']
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            card = conn.execute(
                f'SELECT * FROM {table_name} WHERE id = ?', (card_id,)
            ).fetchone()
            
            if not card:
                return jsonify({'error': 'Card not found'}), 404
            
            return jsonify(get_preview_intervals(dict(card)))
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/export', methods=['GET'])
def export_cards(module):
    """
    Export all flashcards for a module in various formats.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Query Parameters:
        format: 'json' (default) or 'csv'
    
    Returns:
        All cards in the requested format
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    export_format = request.args.get('format', 'json').lower()
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            cards = conn.execute(
                f'SELECT * FROM {table_name} ORDER BY created_at DESC'
            ).fetchall()
            
            markers = [_card_to_marker(dict(card)) for card in cards]
            
            if export_format == 'csv':
                import csv
                import io
                
                output = io.StringIO()
                if markers:
                    # Flatten for CSV
                    fieldnames = ['id', 'subtitleText', 'videoId', 'start', 'end', 
                                  'createdAt', 'nextReviewDate', 'interval', 'easeFactor',
                                  'cardState', 'learningStep']
                    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
                    writer.writeheader()
                    writer.writerows(markers)
                
                from flask import Response
                return Response(
                    output.getvalue(),
                    mimetype='text/csv',
                    headers={'Content-Disposition': f'attachment; filename={module}_flashcards.csv'}
                )
            else:
                return jsonify({
                    'module': module,
                    'exportedAt': date.today().isoformat(),
                    'count': len(markers),
                    'cards': markers
                })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ Forecast & Study Statistics Routes ============

@flashcards_bp.route('/<module>/cards/forecast', methods=['GET'])
def get_forecast(module):
    """
    Get upcoming card review forecast for the next N days.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Query Parameters:
        days: Number of days to forecast (default: 30)
    
    Returns:
        JSON object with daily review counts:
            - forecast: Array of {date, dueCount, newCount, reviewCount}
            - totalDue: Total cards due in forecast period
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    days_ahead = request.args.get('days', 30, type=int)
    days_ahead = min(days_ahead, 365)  # Cap at 1 year
    
    today = date.today()
    
    try:
        table_name = _get_table_name(module)
        with get_db() as conn:
            forecast = []
            total_due = 0
            
            for i in range(days_ahead):
                forecast_date = (today + timedelta(days=i)).isoformat()
                
                # Count review cards due on this date
                review_count = conn.execute(f'''
                    SELECT COUNT(*) FROM {table_name}
                    WHERE card_state = 'review'
                    AND next_review_date = ?
                ''', (forecast_date,)).fetchone()[0]
                
                # Count new cards (only show on day 0)
                new_count = 0
                if i == 0:
                    new_count = conn.execute(f'''
                        SELECT COUNT(*) FROM {table_name}
                        WHERE card_state = 'new' OR card_state IS NULL
                    ''').fetchone()[0]
                
                due_count = review_count + new_count
                total_due += due_count
                
                forecast.append({
                    'date': forecast_date,
                    'dayOffset': i,
                    'dueCount': due_count,
                    'newCount': new_count,
                    'reviewCount': review_count,
                })
            
            return jsonify({
                'forecast': forecast,
                'totalDue': total_due,
                'daysAhead': days_ahead,
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/study-stats', methods=['GET'])
def get_study_stats(module):
    """
    Get study statistics from review log.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
    
    Query Parameters:
        days: Number of days to look back (default: 30)
    
    Returns:
        JSON object with study statistics:
            - today: Reviews today, by rating
            - retention: Percentage of good/easy reviews
            - streak: Current study streak in days
            - history: Array of daily review counts
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    days_back = request.args.get('days', 30, type=int)
    days_back = min(days_back, 365)
    
    now_ms = _get_current_timestamp_ms()
    today_start = int((now_ms // 86400000) * 86400000)  # Start of today in ms
    period_start = today_start - (days_back * 86400000)
    
    try:
        with get_db() as conn:
            # Today's reviews
            today_reviews = conn.execute('''
                SELECT rating, COUNT(*) as count
                FROM review_log
                WHERE module = ? AND reviewed_at >= ?
                GROUP BY rating
            ''', (module, today_start)).fetchall()
            
            today_stats = {'again': 0, 'hard': 0, 'good': 0, 'easy': 0, 'total': 0}
            for row in today_reviews:
                today_stats[row['rating']] = row['count']
                today_stats['total'] += row['count']
            
            # Overall retention (good + easy) / total in period
            period_reviews = conn.execute('''
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN rating IN ('good', 'easy') THEN 1 ELSE 0 END) as passed
                FROM review_log
                WHERE module = ? AND reviewed_at >= ?
            ''', (module, period_start)).fetchone()
            
            retention = 0
            if period_reviews['total'] > 0:
                retention = round((period_reviews['passed'] / period_reviews['total']) * 100, 1)
            
            # Study streak - count consecutive days with reviews
            streak = 0
            check_date = today_start
            while True:
                day_count = conn.execute('''
                    SELECT COUNT(*) FROM review_log
                    WHERE module = ? 
                    AND reviewed_at >= ? 
                    AND reviewed_at < ?
                ''', (module, check_date, check_date + 86400000)).fetchone()[0]
                
                if day_count > 0:
                    streak += 1
                    check_date -= 86400000  # Go back one day
                else:
                    break
                
                # Safety limit
                if streak > 365:
                    break
            
            # Daily history for chart
            history = []
            for i in range(days_back - 1, -1, -1):
                day_start = today_start - (i * 86400000)
                day_end = day_start + 86400000
                day_date = date.fromtimestamp(day_start / 1000).isoformat()
                
                day_reviews = conn.execute('''
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN rating = 'again' THEN 1 ELSE 0 END) as again,
                        SUM(CASE WHEN rating IN ('good', 'easy') THEN 1 ELSE 0 END) as passed
                    FROM review_log
                    WHERE module = ? 
                    AND reviewed_at >= ? 
                    AND reviewed_at < ?
                ''', (module, day_start, day_end)).fetchone()
                
                history.append({
                    'date': day_date,
                    'total': day_reviews['total'] or 0,
                    'again': day_reviews['again'] or 0,
                    'passed': day_reviews['passed'] or 0,
                })
            
            return jsonify({
                'today': today_stats,
                'retention': retention,
                'streak': streak,
                'totalReviewsInPeriod': period_reviews['total'] or 0,
                'history': history,
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@flashcards_bp.route('/<module>/cards/<card_id>/history', methods=['GET'])
def get_card_history(module, card_id):
    """
    Get review history for a specific card.
    
    Path Parameters:
        module: One of 'listening', 'speaking', 'reading', 'writing'
        card_id: Card ID
    
    Returns:
        JSON array of review log entries for this card
    """
    if module not in VALID_MODULES:
        return jsonify({'error': f'Invalid module: {module}'}), 400
    
    try:
        with get_db() as conn:
            reviews = conn.execute('''
                SELECT 
                    reviewed_at,
                    rating,
                    card_state_before,
                    card_state_after,
                    interval_before,
                    interval_after,
                    ease_factor_before,
                    ease_factor_after,
                    time_taken_ms
                FROM review_log
                WHERE card_id = ? AND module = ?
                ORDER BY reviewed_at DESC
                LIMIT 100
            ''', (card_id, module)).fetchall()
            
            history = []
            for row in reviews:
                history.append({
                    'reviewedAt': row['reviewed_at'],
                    'rating': row['rating'],
                    'stateBefore': row['card_state_before'],
                    'stateAfter': row['card_state_after'],
                    'intervalBefore': row['interval_before'],
                    'intervalAfter': row['interval_after'],
                    'easeBefore': row['ease_factor_before'],
                    'easeAfter': row['ease_factor_after'],
                    'timeTakenMs': row['time_taken_ms'],
                })
            
            return jsonify(history)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
