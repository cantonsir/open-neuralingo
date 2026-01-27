"""
Application Configuration

Centralized configuration management for the EchoLoop backend.
"""

import os


class Config:
    """Base configuration class."""
    
    # Database
    DB_FILE = os.environ.get('DB_FILE', 'echoloop.db')
    
    # File uploads
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    ALLOWED_EXTENSIONS = {'pdf', 'epub'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
    # Server
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 3001))
    DEBUG = os.environ.get('DEBUG', 'true').lower() == 'true'
    
    # Segment duration default (4 minutes)
    DEFAULT_SEGMENT_DURATION = 240
    
    # Mastery threshold (80%)
    MASTERY_THRESHOLD = 0.8


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DB_FILE = ':memory:'


# Configuration dictionary for easy access
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
