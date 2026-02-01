import React, { useRef, useEffect, useState } from 'react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';
import { Subtitle, PlayerState } from '../../types';

interface VideoPlayerProps {
  videoId: string;
  audioUrl?: string; // New prop for audio support
  onReady: (player: YouTubePlayer | any) => void;
  onStateChange: (state: PlayerState) => void;
  currentSubtitle: Subtitle | null;
  playbackRate: number;
  forceShowSubtitle: boolean;
  title?: string;
  showTitle?: boolean;
  startTime?: number; // Optional: start position in seconds for the video
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  audioUrl,
  onReady,
  onStateChange,
  currentSubtitle,
  playbackRate,
  forceShowSubtitle,
  title,
  showTitle,
  startTime
}) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHoveringSubs, setIsHoveringSubs] = useState(false);
  const [isError, setIsError] = useState(false);

  // Sync playback rate when it changes in parent
  useEffect(() => {
    if (playerRef.current) {
      // Check if it's a real YouTube player or our mock audio player
      if (typeof playerRef.current.setPlaybackRate === 'function') {
        playerRef.current.setPlaybackRate(playbackRate);
      }
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Safe origin check
  const getOrigin = () => {
    if (typeof window === 'undefined') return undefined;
    const origin = window.location.origin;
    // Don't set origin for local files or if it's null/undefined
    if (!origin || origin === 'null' || origin.startsWith('file://')) {
      return undefined;
    }
    return origin;
  };

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    host: 'https://www.youtube.com', // Crucial for iframe communication
    playerVars: {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      fs: 0,
      disablekb: 1,
      origin: getOrigin(),
      start: startTime ? Math.floor(startTime) : undefined, // Start at specified time if provided
    },
  };

  const handleReady = (event: { target: YouTubePlayer }) => {
    setIsError(false);
    playerRef.current = event.target;
    onReady(event.target);
  };

  const handleError = (event: any) => {
    // Error 150/101/153 usually means embed restriction or origin mismatch
    console.error("YouTube Player Error:", event.data);
    setIsError(true);
  };

  // Standard YouTube API returns numbers synchronously, but the wrapper returns Promises
  const handleStateChange = async (event: { target: YouTubePlayer, data: number }) => {
    const isPlaying = event.data === 1;
    const currentTime = await event.target.getCurrentTime();
    const duration = await event.target.getDuration();
    const playbackRate = await event.target.getPlaybackRate();

    onStateChange({
      currentTime,
      duration,
      isPlaying,
      playbackRate,
    });
  };

  // Audio Player Logic
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      const audio = audioRef.current;

      // Mock Player Object to mimic YouTube API
      const mockPlayer = {
        playVideo: () => audio.play(),
        pauseVideo: () => audio.pause(),
        seekTo: (seconds: number) => { audio.currentTime = seconds; },
        getDuration: () => audio.duration,
        getCurrentTime: () => Promise.resolve(audio.currentTime),
        setPlaybackRate: (rate: number) => { audio.playbackRate = rate; },
        getPlaybackRate: () => audio.playbackRate,
      };

      // Emit initial ready event
      onReady(mockPlayer);
      playerRef.current = mockPlayer as any;

      const updateState = () => {
        onStateChange({
          currentTime: audio.currentTime,
          duration: audio.duration || 0,
          isPlaying: !audio.paused,
          playbackRate: audio.playbackRate
        });
      };

      audio.addEventListener('timeupdate', updateState);
      audio.addEventListener('play', updateState);
      audio.addEventListener('pause', updateState);
      audio.addEventListener('ratechange', updateState);
      audio.addEventListener('loadedmetadata', updateState);

      return () => {
        audio.removeEventListener('timeupdate', updateState);
        audio.removeEventListener('play', updateState);
        audio.removeEventListener('pause', updateState);
        audio.removeEventListener('ratechange', updateState);
        audio.removeEventListener('loadedmetadata', updateState);
      };
    }
  }, [audioUrl, onReady, onStateChange]);

  // Cleanup audio element when switching from audio mode to video mode
  useEffect(() => {
    if (!audioUrl && audioRef.current) {
      const audio = audioRef.current;
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';

      // Clear mock player reference to force fresh YouTube player initialization
      playerRef.current = null;

      console.log('[VideoPlayer] Audio cleanup complete, ready for video');
    }
  }, [audioUrl]);

  return (
    <div
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group flex items-center justify-center"
      ref={containerRef}
    >
      {/* Mode: Audio Player */}
      {audioUrl ? (
        <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center p-8">
          <div className="w-32 h-32 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </div>
          <h3 className="text-white text-xl font-medium mb-2">Audio Session</h3>
          <p className="text-gray-400 text-sm">Listen & Loop Practice</p>
          <audio
            ref={audioRef}
            src={audioUrl}
            className="hidden" // We use custom controls
            controls={false}
            autoPlay
          />
        </div>
      ) : (
        /* Mode: YouTube Player */
        <>
          {isError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-900 z-30">
              <p className="text-xl font-bold text-red-500 mb-2">Video Load Error</p>
              <p className="mb-4">YouTube refused to play this video.</p>
              <p className="text-sm mb-4">
                Try reloading the page. If the issue persists, the video ID might be invalid or the environment restricts embedding.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-white text-sm"
              >
                Reload Page
              </button>
            </div>
          ) : (
            <YouTube
              videoId={videoId}
              opts={opts}
              onReady={handleReady}
              onStateChange={handleStateChange}
              onError={handleError}
              className="absolute inset-0 w-full h-full"
            />
          )}
        </>
      )}

      {/* Subtitle Title Overlay (Audio Sessions) */}
      {showTitle && title && !isError && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <div className="bg-black/60 text-white text-sm md:text-base px-3 py-1.5 rounded-full max-w-3xl truncate">
            {title}
          </div>
        </div>
      )}

      {/* Custom Subtitle Overlay */}
      {currentSubtitle && !isError && (
        <div
          className="absolute bottom-16 left-0 right-0 flex justify-center px-8 z-20 pointer-events-none"
        >
          <div
            className={`
              bg-black/60 text-white text-xl md:text-2xl px-6 py-3 rounded-lg text-center max-w-4xl transition-all duration-300 pointer-events-auto cursor-pointer
              ${(forceShowSubtitle || isHoveringSubs) ? 'blur-0 opacity-100' : 'blur-lg opacity-40 hover:blur-0 hover:opacity-100'}
            `}
            onMouseEnter={() => setIsHoveringSubs(true)}
            onMouseLeave={() => setIsHoveringSubs(false)}
          >
            {/* Remove speaker prefix for cleaner display if present */}
            {currentSubtitle.text.replace(/^[^:]+:\s*/, '')}
          </div>
        </div>
      )}
      


    </div>
  );
};

export default VideoPlayer;
