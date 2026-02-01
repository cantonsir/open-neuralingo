"""
Subtitle Generation Routes

Handles AI-powered subtitle generation using Google Cloud Speech-to-Text.
Falls back to AssemblyAI if Google Cloud fails.
Downloads audio from YouTube videos and transcribes them.
"""

import os
import json
import tempfile
import subprocess
import time
import wave
import re
import random
from typing import Optional
import requests
from flask import Blueprint, request, jsonify

from app.database import get_db

# Try to import Google Cloud Speech (optional dependency)
try:
    from google.cloud import speech_v1p1beta1 as speech
    GOOGLE_SPEECH_AVAILABLE = True
except ImportError:
    GOOGLE_SPEECH_AVAILABLE = False
    print("[Subtitle Gen] WARNING: google-cloud-speech not installed. Run: pip install google-cloud-speech")

# Try to import Google Cloud Storage (optional dependency for long audio)
try:
    from google.cloud import storage
    GOOGLE_STORAGE_AVAILABLE = True
except ImportError:
    GOOGLE_STORAGE_AVAILABLE = False
    print("[Subtitle Gen] WARNING: google-cloud-storage not installed. Run: pip install google-cloud-storage")

subtitle_gen_bp = Blueprint('subtitle_generation', __name__)

GCS_BUCKET_ENV = "GOOGLE_SUBTITLES_BUCKET"
GCS_BUCKET_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '.gcs_bucket')
)


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def check_ytdlp_available():
    """Check if yt-dlp is installed and working."""
    try:
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return True, result.stdout.strip()
        return False, "yt-dlp not working"
    except FileNotFoundError:
        return False, "yt-dlp not installed"
    except Exception as e:
        return False, str(e)


def check_ffmpeg_available():
    """Check if ffmpeg is installed and working."""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            # Extract version from first line
            version_line = result.stdout.split('\n')[0]
            return True, version_line
        return False, "ffmpeg not working"
    except FileNotFoundError:
        return False, "ffmpeg not installed"
    except Exception as e:
        return False, str(e)


def check_google_credentials():
    """Check if Google Cloud credentials are configured."""
    creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not creds_path:
        return False, "GOOGLE_APPLICATION_CREDENTIALS not set"
    if not os.path.exists(creds_path):
        return False, f"Credentials file not found: {creds_path}"
    return True, creds_path


def load_bucket_name() -> Optional[str]:
    """Load GCS bucket name from env or local cache file."""
    bucket_name = os.environ.get(GCS_BUCKET_ENV)
    if bucket_name:
        return bucket_name

    if os.path.exists(GCS_BUCKET_FILE):
        try:
            with open(GCS_BUCKET_FILE, 'r', encoding='utf-8') as handle:
                cached = handle.read().strip()
                return cached or None
        except Exception as e:
            print(f"[Subtitle Gen] Failed to read bucket cache: {e}")
    return None


def save_bucket_name(bucket_name: str) -> None:
    """Persist bucket name to local cache file for reuse."""
    try:
        with open(GCS_BUCKET_FILE, 'w', encoding='utf-8') as handle:
            handle.write(bucket_name)
    except Exception as e:
        print(f"[Subtitle Gen] Failed to write bucket cache: {e}")


def get_project_id_from_credentials() -> Optional[str]:
    """Read project_id from service account JSON, if available."""
    creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not creds_path or not os.path.exists(creds_path):
        return None
    try:
        with open(creds_path, 'r', encoding='utf-8') as handle:
            data = json.load(handle)
            return data.get('project_id')
    except Exception as e:
        print(f"[Subtitle Gen] Failed to read project_id: {e}")
        return None


def sanitize_bucket_name(value: str) -> str:
    """Sanitize a string into a valid GCS bucket name segment."""
    cleaned = re.sub(r'[^a-z0-9-]', '-', value.lower())
    cleaned = re.sub(r'-{2,}', '-', cleaned).strip('-')
    return cleaned[:50] if len(cleaned) > 50 else cleaned


def generate_bucket_name(project_id: Optional[str]) -> str:
    """Generate a globally unique bucket name based on project_id."""
    base = sanitize_bucket_name(project_id or 'project')
    suffix = ''.join(random.choice('0123456789abcdefghijklmnopqrstuvwxyz') for _ in range(6))
    return f"deeplistening-subtitles-{base}-{suffix}"


def ensure_gcs_bucket() -> str:
    """Ensure a GCS bucket exists and return its name. Auto-creates if needed."""
    if not GOOGLE_STORAGE_AVAILABLE:
        raise Exception("google-cloud-storage not installed")

    bucket_name = load_bucket_name()
    client = storage.Client()

    if bucket_name:
        # Skip bucket existence check to avoid requiring storage.buckets.get
        # Upload will fail later if the bucket is missing or inaccessible.
        return bucket_name

    project_id = get_project_id_from_credentials()
    if not project_id:
        raise Exception("Unable to determine project_id. Set GOOGLE_SUBTITLES_BUCKET.")

    # Try creating a unique bucket
    last_error = None
    for _ in range(3):
        candidate = generate_bucket_name(project_id)
        try:
            if client.lookup_bucket(candidate):
                continue
            bucket = client.bucket(candidate)
            client.create_bucket(bucket, location='US')
            save_bucket_name(candidate)
            print(f"[Subtitle Gen] Created GCS bucket: {candidate}")
            return candidate
        except Exception as e:
            last_error = e
            print(f"[Subtitle Gen] Failed to create bucket {candidate}: {e}")

    if last_error:
        raise Exception(f"Failed to auto-create GCS bucket: {last_error}. Please set {GCS_BUCKET_ENV}.")
    raise Exception(f"Failed to auto-create GCS bucket. Please set {GCS_BUCKET_ENV}.")


def get_wav_duration_seconds(audio_path: str) -> float:
    """Get WAV duration in seconds using the wave module."""
    try:
        with wave.open(audio_path, 'rb') as wav_file:
            frames = wav_file.getnframes()
            rate = wav_file.getframerate()
            if rate > 0:
                return frames / float(rate)
    except Exception as e:
        print(f"[Subtitle Gen] Failed to read WAV duration: {e}")
    return 0.0


def upload_audio_to_gcs(bucket_name: str, audio_path: str, object_name: str) -> str:
    """Upload audio file to Google Cloud Storage and return the gs:// URI."""
    if not GOOGLE_STORAGE_AVAILABLE:
        raise Exception("google-cloud-storage not installed")

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    blob.upload_from_filename(audio_path)
    return f"gs://{bucket_name}/{object_name}"


def download_youtube_audio(video_id: str, output_path: str) -> str:
    """
    Download audio from YouTube video using yt-dlp.
    
    Args:
        video_id: YouTube video ID
        output_path: Directory to save the audio file
    
    Returns:
        Path to the downloaded audio file
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    output_template = os.path.join(output_path, f"{video_id}.%(ext)s")
    
    # Use yt-dlp to download audio and convert to WAV format
    # WAV is required for Google Speech-to-Text with word-level timestamps
    cmd = [
        "yt-dlp",
        "-x",  # Extract audio
        "--audio-format", "wav",
        "--audio-quality", "0",  # Best quality
        "--postprocessor-args", "ffmpeg:-ar 16000 -ac 1",  # 16kHz mono (optimal for speech recognition)
        "-o", output_template,
        "--no-playlist",
        url
    ]
    
    print(f"[Subtitle Gen] Running: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        print(f"[Subtitle Gen] yt-dlp stdout: {result.stdout}")
        print(f"[Subtitle Gen] yt-dlp stderr: {result.stderr}")
        
        if result.returncode != 0:
            raise Exception(f"yt-dlp error: {result.stderr}")
        
        # Find the downloaded file
        expected_file = os.path.join(output_path, f"{video_id}.wav")
        if os.path.exists(expected_file):
            return expected_file
        
        # Check for other extensions yt-dlp might use
        import glob
        pattern = os.path.join(output_path, f"{video_id}.*")
        files = glob.glob(pattern)
        print(f"[Subtitle Gen] Found files: {files}")
        
        if files:
            # Return the first audio file found
            for f in files:
                if f.endswith(('.wav', '.mp3', '.m4a', '.webm', '.opus')):
                    return f
            return files[0]
        
        raise Exception(f"Audio file not found after download. Files in dir: {os.listdir(output_path)}")
        
    except subprocess.TimeoutExpired:
        raise Exception("Download timed out (5 minutes)")


# ============================================================================
# GOOGLE CLOUD SPEECH-TO-TEXT
# ============================================================================

def transcribe_audio_google(audio_path: str, audio_uri: Optional[str] = None) -> list:
    """
    Transcribe audio using Google Cloud Speech-to-Text API.
    
    Args:
        audio_path: Path to the audio file (WAV format)
    
    Returns:
        List of subtitle segments with text, start, and duration
    """
    if not GOOGLE_SPEECH_AVAILABLE:
        raise Exception("Google Cloud Speech library not installed")
    
    client = speech.SpeechClient()
    
    if audio_uri:
        print(f"[Subtitle Gen] Using GCS audio URI: {audio_uri}")
        audio = speech.RecognitionAudio(uri=audio_uri)
    else:
        # Read the audio file for inline transcription
        with open(audio_path, "rb") as audio_file:
            content = audio_file.read()

        file_size = len(content)
        print(f"[Subtitle Gen] Audio file size: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)")

        # Check file size limit (Google has 10MB limit for inline content)
        if file_size > 10 * 1024 * 1024:
            raise Exception("Inline audio exceeds size limit. Please use a GCS URI.")

        audio = speech.RecognitionAudio(content=content)
    
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="en-US",
        enable_automatic_punctuation=True,
        enable_word_time_offsets=True,
        alternative_language_codes=[
            "ja-JP",
            "yue-Hant-HK",
            "zh-HK",
            "zh-TW",
            "zh-CN",
            "ko-KR",
            "es-ES",
            "fr-FR",
            "de-DE",
            "pt-BR",
            "it-IT",
        ],
    )
    
    print(f"[Subtitle Gen] Starting Google Speech transcription...")
    
    # Use long running recognition for reliability
    operation = client.long_running_recognize(config=config, audio=audio)
    print("[Subtitle Gen] Waiting for transcription to complete...")
    
    response = operation.result(timeout=600)  # 10 minute timeout
    
    # Process results into subtitle segments
    subtitles = []
    
    for result in response.results:
        if not result.alternatives:
            continue
            
        alternative = result.alternatives[0]
        words = alternative.words if hasattr(alternative, 'words') else []
        
        if words:
            current_segment = {'text': '', 'start': None, 'words': []}
            
            for word_info in words:
                word = word_info.word
                start_time = word_info.start_time.total_seconds()
                end_time = word_info.end_time.total_seconds()
                
                if current_segment['start'] is None:
                    current_segment['start'] = start_time
                
                current_segment['words'].append({
                    'word': word,
                    'start': start_time,
                    'end': end_time
                })
                current_segment['text'] += (' ' if current_segment['text'] else '') + word
                
                # Split at natural breaks (punctuation) or after ~8 words
                should_split = (
                    len(current_segment['words']) >= 8 or
                    word.endswith('.') or
                    word.endswith('?') or
                    word.endswith('!')
                )
                
                if should_split and current_segment['words']:
                    subtitles.append({
                        'text': current_segment['text'].strip(),
                        'start': current_segment['start'],
                        'duration': end_time - current_segment['start']
                    })
                    current_segment = {'text': '', 'start': None, 'words': []}
            
            # Don't forget the last segment
            if current_segment['words']:
                last_word = current_segment['words'][-1]
                subtitles.append({
                    'text': current_segment['text'].strip(),
                    'start': current_segment['start'],
                    'duration': last_word['end'] - current_segment['start']
                })
        else:
            subtitles.append({
                'text': alternative.transcript,
                'start': 0,
                'duration': 5
            })
    
    print(f"[Subtitle Gen] Google Speech generated {len(subtitles)} subtitle segments")
    return subtitles


# ============================================================================
# ASSEMBLYAI FALLBACK
# ============================================================================

def transcribe_audio_assemblyai(audio_path: str) -> list:
    """
    Transcribe audio using AssemblyAI API (fallback).
    
    Args:
        audio_path: Path to the audio file
    
    Returns:
        List of subtitle segments with text, start, and duration
    """
    api_key = os.environ.get('ASSEMBLYAI_API_KEY')
    if not api_key:
        raise Exception("AssemblyAI API key not configured. Set ASSEMBLYAI_API_KEY environment variable.")
    
    headers = {'authorization': api_key}
    base_url = 'https://api.assemblyai.com/v2'
    
    # Step 1: Upload the audio file
    print("[Subtitle Gen] Uploading audio to AssemblyAI...")
    with open(audio_path, 'rb') as f:
        upload_response = requests.post(
            f'{base_url}/upload',
            headers=headers,
            data=f
        )
    
    if upload_response.status_code != 200:
        raise Exception(f"AssemblyAI upload failed: {upload_response.text}")
    
    upload_url = upload_response.json()['upload_url']
    print(f"[Subtitle Gen] Audio uploaded: {upload_url[:50]}...")
    
    # Step 2: Request transcription
    print("[Subtitle Gen] Requesting AssemblyAI transcription...")
    transcript_response = requests.post(
        f'{base_url}/transcript',
        headers=headers,
        json={
            'audio_url': upload_url,
            'language_detection': True,  # Auto-detect language
            'punctuate': True,
            'format_text': True,
        }
    )
    
    if transcript_response.status_code != 200:
        raise Exception(f"AssemblyAI transcription request failed: {transcript_response.text}")
    
    transcript_id = transcript_response.json()['id']
    print(f"[Subtitle Gen] Transcription ID: {transcript_id}")
    
    # Step 3: Poll for completion
    print("[Subtitle Gen] Waiting for AssemblyAI transcription...")
    max_wait = 600  # 10 minutes
    start_time = time.time()
    
    while True:
        if time.time() - start_time > max_wait:
            raise Exception("AssemblyAI transcription timed out")
        
        status_response = requests.get(
            f'{base_url}/transcript/{transcript_id}',
            headers=headers
        )
        
        result = status_response.json()
        status = result.get('status')
        
        if status == 'completed':
            break
        elif status == 'error':
            raise Exception(f"AssemblyAI error: {result.get('error')}")
        
        time.sleep(3)  # Poll every 3 seconds
    
    # Step 4: Process results into subtitles
    subtitles = []
    words = result.get('words', [])
    
    if words:
        current_segment = {'text': '', 'start': None, 'words': []}
        
        for word_info in words:
            word = word_info['text']
            start_ms = word_info['start']
            end_ms = word_info['end']
            
            start_time = start_ms / 1000.0
            end_time = end_ms / 1000.0
            
            if current_segment['start'] is None:
                current_segment['start'] = start_time
            
            current_segment['words'].append({
                'word': word,
                'start': start_time,
                'end': end_time
            })
            current_segment['text'] += (' ' if current_segment['text'] else '') + word
            
            # Split at natural breaks or after ~8 words
            should_split = (
                len(current_segment['words']) >= 8 or
                word.endswith('.') or
                word.endswith('?') or
                word.endswith('!')
            )
            
            if should_split and current_segment['words']:
                subtitles.append({
                    'text': current_segment['text'].strip(),
                    'start': current_segment['start'],
                    'duration': end_time - current_segment['start']
                })
                current_segment = {'text': '', 'start': None, 'words': []}
        
        # Don't forget the last segment
        if current_segment['words']:
            last_word = current_segment['words'][-1]
            subtitles.append({
                'text': current_segment['text'].strip(),
                'start': current_segment['start'],
                'duration': last_word['end'] - current_segment['start']
            })
    else:
        # No word-level timing, use full text
        text = result.get('text', '')
        if text:
            subtitles.append({
                'text': text,
                'start': 0,
                'duration': 60  # Default duration
            })
    
    print(f"[Subtitle Gen] AssemblyAI generated {len(subtitles)} subtitle segments")
    return subtitles


# ============================================================================
# API ROUTES
# ============================================================================

@subtitle_gen_bp.route('/generate-subtitles/config', methods=['GET'])
def check_config():
    """
    Check if subtitle generation is properly configured.
    
    Returns:
        JSON object with configuration status for all components
    """
    config_status = {
        'googleSpeech': {
            'libraryInstalled': GOOGLE_SPEECH_AVAILABLE,
            'credentialsSet': False,
            'credentialsPath': None,
            'status': 'not_configured'
        },
        'gcs': {
            'libraryInstalled': GOOGLE_STORAGE_AVAILABLE,
            'bucketSet': False,
            'bucketName': None,
            'status': 'not_configured'
        },
        'assemblyai': {
            'apiKeySet': bool(os.environ.get('ASSEMBLYAI_API_KEY')),
            'status': 'not_configured'
        },
        'ytdlp': {
            'available': False,
            'version': None,
            'status': 'not_installed'
        },
        'ffmpeg': {
            'available': False,
            'version': None,
            'status': 'not_installed'
        },
        'overallStatus': 'not_ready',
        'readyServices': []
    }
    
    # Check Google Speech
    if GOOGLE_SPEECH_AVAILABLE:
        creds_ok, creds_info = check_google_credentials()
        config_status['googleSpeech']['credentialsSet'] = creds_ok
        config_status['googleSpeech']['credentialsPath'] = creds_info if creds_ok else None
        if creds_ok:
            config_status['googleSpeech']['status'] = 'ready'
            config_status['readyServices'].append('google')
        else:
            config_status['googleSpeech']['status'] = f'credentials_error: {creds_info}'

    # Check GCS bucket
    bucket_name = load_bucket_name()
    if GOOGLE_STORAGE_AVAILABLE:
        config_status['gcs']['bucketSet'] = bool(bucket_name)
        config_status['gcs']['bucketName'] = bucket_name

        if bucket_name:
            config_status['gcs']['status'] = 'ready'
        else:
            # If credentials are set, try auto-creating a bucket so UI shows ready
            creds_ok, _ = check_google_credentials()
            if creds_ok:
                try:
                    bucket_name = ensure_gcs_bucket()
                    config_status['gcs']['bucketSet'] = True
                    config_status['gcs']['bucketName'] = bucket_name
                    config_status['gcs']['status'] = 'auto_created'
                except Exception as e:
                    config_status['gcs']['status'] = f'auto_create_failed: {e}'
            else:
                config_status['gcs']['status'] = f'{GCS_BUCKET_ENV} not set'
    else:
        config_status['gcs']['status'] = 'google-cloud-storage not installed'
    
    # Check AssemblyAI
    if config_status['assemblyai']['apiKeySet']:
        config_status['assemblyai']['status'] = 'ready'
        config_status['readyServices'].append('assemblyai')
    
    # Check yt-dlp
    ytdlp_ok, ytdlp_info = check_ytdlp_available()
    config_status['ytdlp']['available'] = ytdlp_ok
    if ytdlp_ok:
        config_status['ytdlp']['version'] = ytdlp_info
        config_status['ytdlp']['status'] = 'ready'
    else:
        config_status['ytdlp']['status'] = ytdlp_info
    
    # Check ffmpeg
    ffmpeg_ok, ffmpeg_info = check_ffmpeg_available()
    config_status['ffmpeg']['available'] = ffmpeg_ok
    if ffmpeg_ok:
        config_status['ffmpeg']['version'] = ffmpeg_info
        config_status['ffmpeg']['status'] = 'ready'
    else:
        config_status['ffmpeg']['status'] = ffmpeg_info
    
    # Determine overall status
    has_transcription_service = len(config_status['readyServices']) > 0
    has_download_tools = ytdlp_ok and ffmpeg_ok
    has_gcs_bucket = bool(bucket_name)

    if has_transcription_service and has_download_tools and has_gcs_bucket:
        config_status['overallStatus'] = 'ready'
    elif has_transcription_service and has_download_tools and not has_gcs_bucket:
        config_status['overallStatus'] = 'partial_missing_bucket'
    elif has_transcription_service:
        config_status['overallStatus'] = 'partial_missing_tools'
    elif has_download_tools:
        config_status['overallStatus'] = 'partial_missing_transcription'
    else:
        config_status['overallStatus'] = 'not_ready'
    
    return jsonify(config_status)


@subtitle_gen_bp.route('/generate-subtitles', methods=['POST'])
def generate_subtitles():
    """
    Generate subtitles for a YouTube video using speech-to-text.
    
    Tries Google Cloud Speech first, falls back to AssemblyAI if that fails.
    
    Request Body:
        videoId: YouTube video ID (required)
    
    Returns:
        JSON object with subtitles array and metadata
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_id = data.get('videoId')
    if not video_id:
        return jsonify({'error': 'Missing videoId'}), 400
    
    # Check prerequisites
    ytdlp_ok, ytdlp_error = check_ytdlp_available()
    if not ytdlp_ok:
        return jsonify({
            'error': f'yt-dlp is required but not available: {ytdlp_error}. Install with: pip install yt-dlp'
        }), 503
    
    ffmpeg_ok, ffmpeg_error = check_ffmpeg_available()
    if not ffmpeg_ok:
        return jsonify({
            'error': f'ffmpeg is required but not available: {ffmpeg_error}. Install ffmpeg from https://ffmpeg.org/'
        }), 503
    
    # Check if any transcription service is available
    google_ok = GOOGLE_SPEECH_AVAILABLE and check_google_credentials()[0]
    assemblyai_ok = bool(os.environ.get('ASSEMBLYAI_API_KEY'))
    
    if not google_ok and not assemblyai_ok:
        return jsonify({
            'error': 'No transcription service configured. Set up Google Cloud Speech (GOOGLE_APPLICATION_CREDENTIALS) or AssemblyAI (ASSEMBLYAI_API_KEY).'
        }), 503
    
    # Check cache first
    try:
        with get_db() as conn:
            cached = conn.execute('''
                SELECT subtitles_json, language, source
                FROM generated_subtitles
                WHERE video_id = ?
            ''', (video_id,)).fetchone()
            
            if cached:
                print(f"[Subtitle Gen] Using cached subtitles for {video_id}")
                return jsonify({
                    'subtitles': json.loads(cached['subtitles_json']),
                    'language': cached['language'],
                    'source': cached['source'],
                    'cached': True
                })
    except Exception as e:
        print(f"[Subtitle Gen] Cache check error: {e}")
    
    # Download audio
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"[Subtitle Gen] Downloading audio for {video_id}...")
            
            try:
                audio_path = download_youtube_audio(video_id, temp_dir)
                print(f"[Subtitle Gen] Audio downloaded: {audio_path}")
            except Exception as e:
                return jsonify({'error': f'Failed to download audio: {str(e)}'}), 500
            
            # Decide if we should use GCS (long audio)
            file_size = os.path.getsize(audio_path)
            duration_seconds = get_wav_duration_seconds(audio_path)
            use_gcs = file_size > 10 * 1024 * 1024 or duration_seconds > 60

            print(f"[Subtitle Gen] Audio size: {file_size} bytes, duration: {duration_seconds:.2f}s")
            print(f"[Subtitle Gen] Use GCS: {use_gcs}")

            gcs_uri = None
            gcs_bucket_name = load_bucket_name()
            gcs_object_name = None

            # Try Google Cloud Speech first
            subtitles = None
            source = None
            errors = []

            if google_ok:
                try:
                    print("[Subtitle Gen] Trying Google Cloud Speech...")

                    if use_gcs:
                        gcs_bucket_name = ensure_gcs_bucket()
                        gcs_object_name = f"subtitle-audio/{video_id}-{int(time.time())}.wav"
                        gcs_uri = upload_audio_to_gcs(gcs_bucket_name, audio_path, gcs_object_name)
                        print(f"[Subtitle Gen] Uploaded to GCS: {gcs_uri}")

                    subtitles = transcribe_audio_google(audio_path, audio_uri=gcs_uri)
                    source = 'google-speech-to-text'
                except Exception as e:
                    error_msg = str(e)
                    print(f"[Subtitle Gen] Google Speech failed: {error_msg}")
                    errors.append(f"Google Speech: {error_msg}")

            # Fallback to AssemblyAI
            if subtitles is None and assemblyai_ok:
                try:
                    print("[Subtitle Gen] Falling back to AssemblyAI...")
                    subtitles = transcribe_audio_assemblyai(audio_path)
                    source = 'assemblyai'
                except Exception as e:
                    error_msg = str(e)
                    print(f"[Subtitle Gen] AssemblyAI failed: {error_msg}")
                    errors.append(f"AssemblyAI: {error_msg}")

            # Keep GCS object for reuse and caching
            
            if subtitles is None:
                error_details = '; '.join(errors) if errors else 'Unknown error'
                return jsonify({'error': f'All transcription services failed. {error_details}'}), 500
            
            if not subtitles:
                return jsonify({'error': 'No speech detected in video'}), 400
            
            # Cache the results
            try:
                with get_db() as conn:
                    conn.execute('''
                        INSERT OR REPLACE INTO generated_subtitles 
                        (video_id, subtitles_json, language, source, generated_at, audio_gcs_uri, audio_duration_seconds, audio_size_bytes)
                        VALUES (?, ?, ?, ?, strftime('%s', 'now') * 1000, ?, ?, ?)
                    ''', (
                        video_id,
                        json.dumps(subtitles),
                        'auto',
                        source,
                        gcs_uri,
                        duration_seconds if duration_seconds > 0 else None,
                        file_size if file_size > 0 else None
                    ))
                    conn.commit()
                    print(f"[Subtitle Gen] Cached subtitles for {video_id}")
            except Exception as e:
                print(f"[Subtitle Gen] Failed to cache: {e}")
            
            return jsonify({
                'subtitles': subtitles,
                'language': 'auto',
                'source': source,
                'cached': False
            })
            
    except Exception as e:
        print(f"[Subtitle Gen] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@subtitle_gen_bp.route('/generate-subtitles/status/<video_id>', methods=['GET'])
def check_generation_status(video_id):
    """
    Check if subtitles have been generated for a video.
    
    Returns:
        JSON with status and cached data if available
    """
    try:
        with get_db() as conn:
            cached = conn.execute('''
                SELECT subtitles_json, language, source, generated_at, audio_gcs_uri, audio_duration_seconds, audio_size_bytes
                FROM generated_subtitles
                WHERE video_id = ?
            ''', (video_id,)).fetchone()
            
            if cached:
                return jsonify({
                    'exists': True,
                    'language': cached['language'],
                    'source': cached['source'],
                    'generatedAt': cached['generated_at'],
                    'subtitleCount': len(json.loads(cached['subtitles_json'])),
                    'audioGcsUri': cached['audio_gcs_uri'],
                    'audioDurationSeconds': cached['audio_duration_seconds'],
                    'audioSizeBytes': cached['audio_size_bytes']
                })
            else:
                return jsonify({'exists': False})
                
    except Exception as e:
        return jsonify({'error': str(e)}), 500
