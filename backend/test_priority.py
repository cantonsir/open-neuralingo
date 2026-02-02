from youtube_transcript_api import YouTubeTranscriptApi

video_id = 'jNQXAC9IVRw' # Me at the zoo

print(f"Testing priority logic for video: {video_id}")

try:
    ytt = YouTubeTranscriptApi()
    transcript_list = ytt.list(video_id)
    
    # Filter for English transcripts
    english_transcripts = [t for t in transcript_list if t.language_code.startswith('en')]
    
    print(f"Found {len(english_transcripts)} English transcripts:")
    for t in english_transcripts:
        print(f" - [{t.language_code}] Generated={t.is_generated}")

    # Segregate into manual and auto-generated
    manual_en = [t for t in english_transcripts if not t.is_generated]
    auto_en = [t for t in english_transcripts if t.is_generated]
    
    selected_transcript = None
    
    print(f"Manual count: {len(manual_en)}")
    print(f"Auto count: {len(auto_en)}")

    if manual_en:
        # Priority: en-US > en > en-GB > any other manual
        prioritized_codes = ['en-US', 'en', 'en-GB']
        for code in prioritized_codes:
            found = next((t for t in manual_en if t.language_code == code), None)
            if found:
                selected_transcript = found
                print(f"Selected match for priority code: {code}")
                break
        
        if not selected_transcript:
            selected_transcript = manual_en[0]
            print("Selected first available manual (no specific priority match).")
    
    elif auto_en:
        selected_transcript = auto_en[0]
        print("Selected auto-generated (no manual found).")
    
    if selected_transcript:
         print(f"FINAL SELECTION: [{selected_transcript.language_code}] Generated={selected_transcript.is_generated}")
         if not selected_transcript.is_generated:
             print("SUCCESS: Selected manual transcript.")
         else:
             print("WARNING: Selected auto-generated (expected manual if available).")
    else:
        print("FAILURE: No transcript selected.")

except Exception as e:
    print(f"Error: {e}")
