"""
EchoLoop Backend - Main Entry Point

Usage:
    python run.py [--host HOST] [--port PORT] [--debug]

Examples:
    python run.py                    # Run with defaults (0.0.0.0:3001, debug=True)
    python run.py --port 5000        # Run on port 5000
    python run.py --debug            # Run in debug mode
"""

import argparse
import os

from app import create_app
from app.config import Config
from app.database import ensure_upload_folder, migrate_add_subtitle_columns


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='EchoLoop Backend Server',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--host',
        default=Config.HOST,
        help=f'Host to bind to (default: {Config.HOST})'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=Config.PORT,
        help=f'Port to bind to (default: {Config.PORT})'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        default=Config.DEBUG,
        help='Enable debug mode'
    )
    return parser.parse_args()


def main():
    """Main entry point for the application."""
    args = parse_args()
    
    # Ensure upload folder exists
    ensure_upload_folder()

    # Ensure subtitle columns exist
    try:
        migrate_add_subtitle_columns()
    except Exception as e:
        print(f"Migration warning: {e}")
    
    # Create and run the application
    app = create_app()
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                    EchoLoop Backend                          ║
╠══════════════════════════════════════════════════════════════╣
║  Running on: http://{args.host}:{args.port}                          
║  Debug mode: {'ON' if args.debug else 'OFF'}                                          
║  Database: {Config.DB_FILE}                               
╚══════════════════════════════════════════════════════════════╝
    """)
    
    app.run(
        host=args.host,
        port=args.port,
        debug=args.debug
    )


if __name__ == '__main__':
    main()
