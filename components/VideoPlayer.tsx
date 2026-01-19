import React, { useRef, useEffect, useState } from 'react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';
import { Subtitle, PlayerState } from '../types';

interface VideoPlayerProps {
  videoId: string;
  onReady: (player: YouTubePlayer) => void;
  onStateChange: (state: PlayerState) => void;
  currentSubtitle: Subtitle | null;
  playbackRate: number;
  forceShowSubtitle: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  onReady,
  onStateChange,
  currentSubtitle,
  playbackRate,
  forceShowSubtitle
}) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHoveringSubs, setIsHoveringSubs] = useState(false);
  const [isError, setIsError] = useState(false);

  // Sync playback rate when it changes in parent
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(playbackRate);
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

  return (
    <div
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group"
      ref={containerRef}
    >
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

      {/* Custom Subtitle Overlay */}
      {currentSubtitle && !isError && (
        <div
          className="absolute bottom-16 left-0 right-0 flex justify-center px-8 z-20 pointer-events-none"
        >
          <div
            className={`
              bg-black/60 text-white text-xl md:text-2xl px-6 py-3 rounded-lg text-center max-w-4xl transition-all duration-300 pointer-events-auto cursor-pointer
              ${(forceShowSubtitle || isHoveringSubs) ? 'blur-0 opacity-100' : 'blur-sm opacity-60 hover:blur-0 hover:opacity-100'}
            `}
            onMouseEnter={() => setIsHoveringSubs(true)}
            onMouseLeave={() => setIsHoveringSubs(false)}
          >
            {currentSubtitle.text}
          </div>
        </div>
      )}


      {/* Visual hint for subtitle interaction */}
      {currentSubtitle && !(forceShowSubtitle || isHoveringSubs) && !isError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs z-10 pointer-events-none">
          Hover or press 'S' to reveal
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;