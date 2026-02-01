"""
Routes Package

Contains all API route blueprints for the application.
"""

from app.routes.transcript import transcript_bp
from app.routes.flashcards import flashcards_bp
from app.routes.history import history_bp
from app.routes.lessons import lessons_bp
from app.routes.goals import goals_bp
from app.routes.assessment import assessment_bp
from app.routes.segment_learning import segment_learning_bp
from app.routes.library import library_bp
from app.routes.speaking import speaking_bp
from app.routes.writing import writing_bp
from app.routes.subtitle_generation import subtitle_gen_bp

__all__ = [
    'transcript_bp',
    'flashcards_bp',
    'history_bp',
    'lessons_bp',
    'goals_bp',
    'assessment_bp',
    'segment_learning_bp',
    'library_bp',
    'speaking_bp',
    'writing_bp',
    'subtitle_gen_bp',
]
