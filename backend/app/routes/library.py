"""
Library Routes

Handles file uploads, content management, and YouTube/URL imports for the library.
"""

import os
import time
import uuid
import re
import requests
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
            ytt_api = YouTubeTranscriptApi()
            transcript_list = ytt_api.list(video_id)
            
            # Filter for English transcripts
            english_transcripts = [t for t in transcript_list if t.language_code.startswith('en')]
            
            # Segregate into manual and auto-generated
            manual_en = [t for t in english_transcripts if not t.is_generated]
            auto_en = [t for t in english_transcripts if t.is_generated]
            
            selected_transcript = None
            
            if manual_en:
                # Priority: en-US > en > en-GB > any other manual
                prioritized_codes = ['en-US', 'en', 'en-GB']
                for code in prioritized_codes:
                    found = next((t for t in manual_en if t.language_code == code), None)
                    if found:
                        selected_transcript = found
                        break
                
                if not selected_transcript:
                    selected_transcript = manual_en[0]
            
            elif auto_en:
                selected_transcript = auto_en[0]
            
            if selected_transcript:
                transcript_data = selected_transcript.fetch().to_raw_data()
            else:
                 # Fallback to old behavior behavior if no English list found (unlikely if we are here)
                 # But sticking to previous logic: try strict fetch
                 try:
                    transcript_obj = ytt_api.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
                    transcript_data = transcript_obj.to_raw_data()
                 except:
                    transcript_obj = ytt_api.fetch(video_id)
                    transcript_data = transcript_obj.to_raw_data()

            text_content = " ".join([t['text'] for t in transcript_data])
        except Exception as e:
            return jsonify({'error': f'Failed to fetch transcript: {str(e)}'}), 500

        if not title:
            video_title = _fetch_youtube_title(video_id)
            title = f"YouTube: {video_title}" if video_title else f"YouTube: {video_id}"

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


def _is_youtube_url(url: str) -> tuple[bool, str | None]:
    """
    Check if URL is a YouTube video and extract video ID.
    
    Returns:
        (is_youtube, video_id)
    """
    youtube_regex = r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})'
    match = re.search(youtube_regex, url)
    if match:
        return True, match.group(1)
    return False, None


def _fetch_youtube_title(video_id: str) -> str | None:
    """
    Fetch a YouTube video title via oEmbed (no API key required).

    Returns:
        title string or None
    """
    try:
        response = requests.get(
            'https://www.youtube.com/oembed',
            params={'url': f'https://www.youtube.com/watch?v={video_id}', 'format': 'json'},
            timeout=10
        )
        if response.ok:
            data = response.json()
            title = data.get('title')
            if title:
                return title.strip()
    except Exception:
        return None
    return None


def _extract_article_content(url: str) -> tuple[str, str]:
    """
    Extract article content from a website URL.
    
    Returns:
        (title, content)
    """
    try:
        # Fetch the webpage
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract title
        title = soup.find('title')
        title_text = title.get_text().strip() if title else url
        
        # Remove script and style elements
        for script in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            script.decompose()
        
        # Try to find article content
        article = None
        
        # Try common article containers
        for selector in ['article', '.article-content', '.post-content', '.entry-content', 
                        'main', '.content', '#content']:
            article = soup.select_one(selector)
            if article:
                break
        
        if not article:
            # Fallback to body
            article = soup.find('body')
        
        # Extract text
        if article:
            # Get paragraphs
            paragraphs = article.find_all('p')
            content = '\n\n'.join([p.get_text().strip() for p in paragraphs if p.get_text().strip()])
            
            # If no paragraphs found, get all text
            if not content:
                content = article.get_text(separator='\n', strip=True)
        else:
            content = soup.get_text(separator='\n', strip=True)
        
        # Clean up extra whitespace
        content = re.sub(r'\n\s*\n', '\n\n', content)
        content = content.strip()
        
        return title_text, content
        
    except requests.RequestException as e:
        raise Exception(f"Failed to fetch URL: {str(e)}")
    except Exception as e:
        raise Exception(f"Failed to extract content: {str(e)}")


@library_bp.route('/library/import/url', methods=['POST'])
def import_url_to_library():
    """
    Import content from a URL (YouTube video or article) to library.
    
    Request Body:
        url: URL to import (YouTube video or article)
    
    Returns:
        Created library item with ID and title
    """
    data = request.json
    url = data.get('url', '').strip()
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    try:
        # Check if it's a YouTube URL
        is_youtube, video_id = _is_youtube_url(url)
        
        if is_youtube:
            # Handle YouTube video
            try:
                ytt_api = YouTubeTranscriptApi()
                transcript_list = ytt_api.list(video_id)
                
                # Filter for English transcripts
                english_transcripts = [t for t in transcript_list if t.language_code.startswith('en')]
                
                # Segregate into manual and auto-generated
                manual_en = [t for t in english_transcripts if not t.is_generated]
                auto_en = [t for t in english_transcripts if t.is_generated]
                
                selected_transcript = None
                
                if manual_en:
                    # Priority: en-US > en > en-GB > any other manual
                    prioritized_codes = ['en-US', 'en', 'en-GB']
                    for code in prioritized_codes:
                        found = next((t for t in manual_en if t.language_code == code), None)
                        if found:
                            selected_transcript = found
                            break
                    
                    if not selected_transcript:
                        selected_transcript = manual_en[0]
                
                elif auto_en:
                    selected_transcript = auto_en[0]
                
                if selected_transcript:
                    transcript_data = selected_transcript.fetch().to_raw_data()
                else:
                    try:
                        transcript_obj = ytt_api.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
                        transcript_data = transcript_obj.to_raw_data()
                    except:
                        transcript_obj = ytt_api.fetch(video_id)
                        transcript_data = transcript_obj.to_raw_data()

                text_content = " ".join([t['text'] for t in transcript_data])
            except Exception as e:
                return jsonify({'error': f'Failed to fetch YouTube transcript: {str(e)}'}), 500
            
            video_title = _fetch_youtube_title(video_id)
            title = f"YouTube: {video_title}" if video_title else f"YouTube: {video_id}"
            file_type = 'youtube'
            
        else:
            # Handle regular website/article
            try:
                title, text_content = _extract_article_content(url)
                file_type = 'article'
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        # Validate content
        if not text_content or len(text_content.strip()) < 50:
            return jsonify({'error': 'Unable to extract sufficient content from URL'}), 400
        
        # Save to database
        with get_db() as conn:
            library_id = str(uuid.uuid4())
            created_at = int(time.time() * 1000)
            
            conn.execute('''
                INSERT INTO library (id, title, filename, file_type, content_text, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (library_id, title, url, file_type, text_content, created_at))
            
            conn.commit()
            
            return jsonify({
                'status': 'success', 
                'id': library_id,
                'title': title,
                'type': file_type
            }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
