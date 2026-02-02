from youtube_transcript_api import YouTubeTranscriptApi

video_id = 'jNQXAC9IVRw' # Me at the zoo

print(f"Listing transcripts for video: {video_id}")

try:
    ytt = YouTubeTranscriptApi()
    print(f"Listing transcripts (using .list()) for video: {video_id}")
    transcript_list = ytt.list(video_id)
    
    print(f"\nResult type: {type(transcript_list)}")
    
    print("\nAvailable transcripts:")
    for transcript in transcript_list:
        print(f"Type: {type(transcript)}")
        print(f"Dir: {dir(transcript)}")
        try:
            print(f"Code: {transcript.language_code}")
            print(f"Name: {transcript.language}") 
            print(f"Is Generated: {transcript.is_generated}")
        except:
             print("Could not access standard attributes, printing dict:")
             print(transcript.__dict__)
        print("-" * 20)
        
except Exception as e:
    print(f"Error: {e}")
