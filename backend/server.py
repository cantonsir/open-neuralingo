from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi

app = Flask(__name__)
CORS(app)

@app.route('/api/transcript', methods=['GET'])
def get_transcript():
    video_id = request.args.get('videoId')
    if not video_id:
        return jsonify({'error': 'Missing videoId parameter'}), 400

    try:
        # Initializing the API client (required for this version of the library)
        api = YouTubeTranscriptApi()
        
        # Fetch returns a FetchedTranscript object
        transcript_obj = api.fetch(video_id)
        
        # Convert to list of dicts using the method provided by the library
        transcript_data = transcript_obj.to_raw_data()
        
        return jsonify(transcript_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
