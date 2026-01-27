"""
Transcript Routes

Handles YouTube transcript fetching and language listing.
"""

import traceback
from flask import Blueprint, request, jsonify
from youtube_transcript_api import YouTubeTranscriptApi


transcript_bp = Blueprint('transcript', __name__)


@transcript_bp.route('/transcript', methods=['GET'])
def get_transcript():
    """
    Fetch transcript for a YouTube video.
    
    Query Parameters:
        videoId: YouTube video ID (required)
        language: Language code (default: 'en')
    
    Returns:
        JSON array of transcript segments with text, start time, and duration
    """
    video_id = request.args.get('videoId')
    language = request.args.get('language', 'en')
    
    if not video_id:
        return jsonify({'error': 'Missing videoId parameter'}), 400

    try:
        ytt_api = YouTubeTranscriptApi()
        
        # Try to fetch the specified language
        try:
            transcript_obj = ytt_api.fetch(video_id, languages=[language])
        except Exception:
            # Fallback: try to get any available transcript
            transcript_obj = ytt_api.fetch(video_id)
        
        transcript_data = transcript_obj.to_raw_data()
        return jsonify(transcript_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@transcript_bp.route('/transcript/languages', methods=['GET'])
def get_transcript_languages():
    """
    Get available subtitle languages for a YouTube video.
    
    Query Parameters:
        videoId: YouTube video ID (required)
    
    Returns:
        JSON object with available languages and their properties
    """
    video_id = request.args.get('videoId')
    
    if not video_id:
        return jsonify({'error': 'Missing videoId parameter'}), 400

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript_list = ytt_api.list(video_id)
        
        languages = []
        
        try:
            for transcript in transcript_list:
                languages.append({
                    'code': transcript.language_code,
                    'name': transcript.language,
                    'isGenerated': transcript.is_generated,
                    'isTranslatable': transcript.is_translatable
                })
        except Exception:
            # Fallback: access the underlying dictionaries
            for lang_code, transcript in transcript_list._manually_created_transcripts.items():
                languages.append({
                    'code': lang_code,
                    'name': transcript.language,
                    'isGenerated': False,
                    'isTranslatable': transcript.is_translatable
                })
            for lang_code, transcript in transcript_list._generated_transcripts.items():
                languages.append({
                    'code': lang_code,
                    'name': transcript.language,
                    'isGenerated': True,
                    'isTranslatable': transcript.is_translatable
                })
        
        return jsonify({
            'videoId': video_id,
            'languages': languages,
            'count': len(languages)
        })
        
    except Exception as e:
        print(f"Error fetching languages: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500
