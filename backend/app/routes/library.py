"""
Library Routes

Handles file uploads, content management, and YouTube imports for the library.
"""

import os
import time
import uuid
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

import PyPDF2
from ebooklib import epub
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi

from app.database import get_db, ensure_upload_folder
from app.config import Config


library_bp = Blueprint('library', __name__)


def _allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def _extract_pdf_text(file_path: str) -> str:
    """Extract text content from a PDF file."""
    text_content = ""
    with open(file_path, 'rb') as f:
        pdf_reader = PyPDF2.PdfReader(f)
        for page in pdf_reader.pages:
            text_content += page.extract_text() or ""
    return text_content


def _extract_epub_text(file_path: str) -> str:
    """Extract text content from an EPUB file."""
    text_content = ""
    try:
        book = epub.read_epub(file_path)
        for item in book.get_items():
            if item.get_type() == epub.ITEM_DOCUMENT:
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                text_content += soup.get_text() + "\n"
    except Exception as e:
        print(f"EPUB Error: {e}")
    return text_content


@library_bp.route('/upload', methods=['POST'])
def upload_file():
    """
    Upload a PDF or EPUB file to the library.
    
    Form Data:
        file: The file to upload
    
    Returns:
        Created library item ID
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not file or not _allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    ensure_upload_folder()
    
    filename = secure_filename(file.filename)
    file_path = os.path.join(Config.UPLOAD_FOLDER, filename)
    file.save(file_path)
    
    file_type = filename.rsplit('.', 1)[1].lower()
    
    try:
        # Extract text based on file type
        if file_type == 'pdf':
            text_content = _extract_pdf_text(file_path)
        elif file_type == 'epub':
            text_content = _extract_epub_text(file_path)
        else:
            text_content = ""
            
    except Exception as e:
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 500

    # Save to database
    try:
        with get_db() as conn:
            library_id = str(uuid.uuid4())
            created_at = int(time.time() * 1000)
            
            conn.execute('''
                INSERT INTO library (id, title, filename, file_type, content_text, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (library_id, filename, filename, file_type, text_content, created_at))
            
            conn.commit()
            
            return jsonify({'status': 'success', 'id': library_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@library_bp.route('/library', methods=['GET'])
def get_library():
    """
    Get all library items.
    
    Returns:
        Array of library items (without content text)
    """
    try:
        with get_db() as conn:
            items = conn.execute('''
                SELECT id, title, filename, file_type, created_at 
                FROM library 
                ORDER BY created_at DESC
            ''').fetchall()
            
            return jsonify([dict(i) for i in items])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@library_bp.route('/library/import/youtube', methods=['POST'])
def import_youtube_to_library():
    """
    Import YouTube video transcript to library.
    
    Request Body:
        videoId: YouTube video ID
        title: Optional title
    
    Returns:
        Created library item ID
    """
    data = request.json
    video_id = data.get('videoId')
    title = data.get('title')
    
    if not video_id:
        return jsonify({'error': 'Missing videoId'}), 400
        
    try:
        # Fetch transcript
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            try:
                transcript = transcript_list.find_transcript(['en'])
            except:
                transcript = transcript_list.find_transcript(['en-US', 'en-GB'])
            text_content = " ".join([p.text for p in transcript.fetch()])
        except:
            try:
                transcript = YouTubeTranscriptApi.get_transcript(video_id)
                text_content = "\n".join([t['text'] for t in transcript])
            except Exception as e:
                return jsonify({'error': f'Failed to fetch transcript: {str(e)}'}), 500

        if not title:
            title = f"YouTube Import ({video_id})"

        with get_db() as conn:
            library_id = str(uuid.uuid4())
            created_at = int(time.time() * 1000)
            
            conn.execute('''
                INSERT INTO library (id, title, filename, file_type, content_text, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (library_id, title, video_id, 'youtube', text_content, created_at))
            
            conn.commit()
            
            return jsonify({'status': 'success', 'id': library_id}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@library_bp.route('/library/<library_id>/content', methods=['GET'])
def get_library_content(library_id):
    """
    Get the full content of a library item.
    
    Path Parameters:
        library_id: Library item ID
    
    Returns:
        Content text of the library item
    """
    try:
        with get_db() as conn:
            item = conn.execute(
                'SELECT content_text FROM library WHERE id = ?', (library_id,)
            ).fetchone()
            
            if item:
                return jsonify({'content': item['content_text']})
            else:
                return jsonify({'error': 'Item not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@library_bp.route('/library/<library_id>', methods=['DELETE'])
def delete_library_item(library_id):
    """
    Delete a library item.
    
    Path Parameters:
        library_id: Library item ID to delete
    
    Returns:
        Deletion status
    """
    try:
        with get_db() as conn:
            conn.execute('DELETE FROM library WHERE id = ?', (library_id,))
            conn.commit()
            
            return jsonify({'status': 'deleted'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
