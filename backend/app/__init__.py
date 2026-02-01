"""
EchoLoop Backend Application Factory

A modular Flask application for language learning with YouTube integration.
"""

from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.database import init_db, migrate_db


def create_app(config_class=Config):
    """
    Application factory for creating Flask app instances.
    
    Args:
        config_class: Configuration class to use (default: Config)
    
    Returns:
        Flask application instance
    """
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    CORS(app)
    
    # Initialize database
    init_db()
    migrate_db()
    
    # Register blueprints
    from app.routes.transcript import transcript_bp
    from app.routes.flashcards import flashcards_bp
    from app.routes.history import history_bp
    from app.routes.lessons import lessons_bp
    from app.routes.goals import goals_bp
    from app.routes.assessment import assessment_bp
    from app.routes.assessment_stats import assessment_stats_bp
    from app.routes.segment_learning import segment_learning_bp
    from app.routes.library import library_bp
    from app.routes.speaking import speaking_bp
    from app.routes.writing import writing_bp
    from app.routes.listening import listening_bp
    from app.routes.reading import reading_bp
    from app.routes.practice_sessions import practice_sessions_bp
    from app.routes.subtitle_generation import subtitle_gen_bp

    app.register_blueprint(transcript_bp, url_prefix='/api')
    app.register_blueprint(flashcards_bp, url_prefix='/api')
    app.register_blueprint(history_bp, url_prefix='/api')
    app.register_blueprint(lessons_bp, url_prefix='/api')
    app.register_blueprint(goals_bp, url_prefix='/api')
    app.register_blueprint(assessment_bp, url_prefix='/api')
    app.register_blueprint(assessment_stats_bp, url_prefix='/api')
    app.register_blueprint(segment_learning_bp, url_prefix='/api')
    app.register_blueprint(library_bp, url_prefix='/api')
    app.register_blueprint(speaking_bp, url_prefix='/api')
    app.register_blueprint(writing_bp, url_prefix='/api')
    app.register_blueprint(listening_bp, url_prefix='/api')
    app.register_blueprint(reading_bp, url_prefix='/api')
    app.register_blueprint(practice_sessions_bp, url_prefix='/api')
    app.register_blueprint(subtitle_gen_bp, url_prefix='/api')

    return app
