import React, { useState, useEffect, useRef, useCallback } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { Play, Pause, RotateCcw, Volume2, Settings, Download, Search, Zap, Eye, EyeOff } from 'lucide-react';

import VideoPlayer from './components/VideoPlayer';
import MarkerList from './components/MarkerList';
import Timeline from './components/Timeline';
import { Marker, Subtitle, PlayerState, TagType, DEMO_VIDEO_ID, DEMO_SUBTITLES } from './types';
import { parseSubtitles, parseYouTubeXml, parseTime, formatTime } from './utils';

function App() {
  // --- State ---
  const [videoId, setVideoId] = useState<string>('');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [inputSubs, setInputSubs] = useState<string>('');
  const [isSetupMode, setIsSetupMode] = useState<boolean>(true);

  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    playbackRate: 1.0,
  });

  const [subtitlesVisible, setSubtitlesVisible] = useState<boolean>(false);
  const [isPeekingSubs, setIsPeekingSubs] = useState<boolean>(false);

  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [currentLoop, setCurrentLoop] = useState<Marker | null>(null);

  // Ref for the loop interval
  const loopIntervalRef = useRef<number | null>(null);

  // --- Initialization ---

  const loadVideo = (id: string, subText: string) => {
    setVideoId(id);
    if (subText.trim()) {
      setSubtitles(parseSubtitles(subText));
    }
    setIsSetupMode(false);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Extract ID from URL
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = inputUrl.match(regExp);
    const id = (match && match[2].length === 11) ? match[2] : null;

    if (id) {
      loadVideo(id, inputSubs);
    } else {
      alert('Invalid YouTube URL');
    }
  };

  const loadDemo = () => {
    setVideoId(DEMO_VIDEO_ID);
    setSubtitles(parseSubtitles(DEMO_SUBTITLES));
    setIsSetupMode(false);
  };

  const [isFetchingSubs, setIsFetchingSubs] = useState(false);

  const fetchSubtitles = async (id: string) => {
    setIsFetchingSubs(true);
    try {
      const response = await fetch(`/api/transcript?videoId=${id}`);
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();

      const parsed: Subtitle[] = data.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        start: item.start,
        end: item.start + item.duration,
        text: item.text
      }));

      setSubtitles(parsed);
      setIsSetupMode(false); // Auto-start if successful
    } catch (error) {
      console.error(error);
      alert('Failed to fetch subtitles. Make sure the backend server is running (python backend/server.py)!');
    } finally {
      setIsFetchingSubs(false);
    }
  };

  // --- Subtitle Logic ---

  const getCurrentSubtitle = (): Subtitle | null => {
    return subtitles.find(
      s => state.currentTime >= s.start && state.currentTime <= s.end
    ) || null;
  };

  // --- Marker Logic (The "Space" Key) ---

  const addMarker = useCallback(async () => {
    if (!player) return;

    // YouTube API wrapper returns Promise
    const t = await player.getCurrentTime();
    const now = Date.now();

    setMarkers(prevMarkers => {
      // 1. Find EXACT current subtitle
      let sub = subtitles.find(s => t >= s.start && t <= s.end);

      // 2. Strict Fallback: If no exact match (e.g. gap between sentences), find the CLOSEST one within 1s
      if (!sub && subtitles.length > 0) {
        const closest = subtitles.reduce((prev, curr) => {
          const prevDist = Math.min(Math.abs(t - prev.start), Math.abs(t - prev.end));
          const currDist = Math.min(Math.abs(t - curr.start), Math.abs(t - curr.end));
          return currDist < prevDist ? curr : prev;
        });
        // Only snap if we are very close (1s) to it
        if (Math.min(Math.abs(t - closest.start), Math.abs(t - closest.end)) < 1.0) {
          sub = closest;
        }
      }

      let start, end, subtitleText;

      if (sub) {
        // STRICT SNAP
        start = sub.start;
        end = sub.end;
        subtitleText = sub.text;

        // IDEMPOTENCY check replaced by PRESS COUNT logic:
        // If the last marker is already exactly this subtitle, increment its pressCount.
        const lastMarker = prevMarkers[prevMarkers.length - 1];
        if (lastMarker && Math.abs(lastMarker.start - start) < 0.1 && Math.abs(lastMarker.end - end) < 0.1) {
          const updatedMarker = {
            ...lastMarker,
            pressCount: (lastMarker.pressCount || 1) + 1
          };
          return [...prevMarkers.slice(0, -1), updatedMarker];
        }
      } else {
        // Fallback if truly no subtitle found nearby
        start = Math.max(0, t - 2);
        end = t + 2;
        subtitleText = undefined;
      }

      const newMarker: Marker = {
        id: Math.random().toString(36).substr(2, 9),
        start,
        end,
        createdAt: now,
        subtitleText,
        tags: []
      };

      return [...prevMarkers, newMarker];
    });
  }, [player, subtitles]);

  // Global Keyboard Listener for Space and S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSetupMode) return;

      // Space bar: Create marker
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        addMarker();
      }

      // S key: Peek subtitle
      if (e.code === 'KeyS' && !e.repeat) {
        setIsPeekingSubs(true);
      }

      // K / P: Toggle Play/Pause
      if (e.key === 'k' || e.key === 'p') {
        if (state.isPlaying) player?.pauseVideo();
        else player?.playVideo();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyS') {
        setIsPeekingSubs(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [addMarker, isSetupMode, player, state.isPlaying]);


  // --- Loop Engine ---

  useEffect(() => {
    if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);

    if (currentLoop && state.isPlaying) {
      loopIntervalRef.current = window.setInterval(async () => {
        if (!player) return;
        const t = await player.getCurrentTime();

        // If we passed the end, seek back to start
        if (t >= currentLoop.end || t < currentLoop.start - 1) { // -1 tolerance for seeking back
          player.seekTo(currentLoop.start, true);
        }
      }, 100); // Check every 100ms
    }

    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
    };
    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
    };
  }, [currentLoop, state.isPlaying, player]);

  // --- Time Polling (Progress Bar Fix) ---
  useEffect(() => {
    let interval: number;
    if (state.isPlaying && player) {
      interval = window.setInterval(async () => {
        const t = await player.getCurrentTime();
        setState(prev => ({ ...prev, currentTime: t }));
      }, 200); // Update every 200ms
    }
    return () => clearInterval(interval);
  }, [state.isPlaying, player]);

  // --- Handlers ---

  const handlePlayLoop = (marker: Marker) => {
    setCurrentLoop(marker);
    player?.seekTo(marker.start, true);
    player?.playVideo();
  };

  const handleStopLoop = () => {
    setCurrentLoop(null);
  };

  const handleDeleteMarker = (id: string) => {
    if (currentLoop?.id === id) handleStopLoop();
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  const handleAddTag = (id: string, tag: TagType) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id && !m.tags.includes(tag)) {
        return { ...m, tags: [...m.tags, tag] };
      }
      return m;
    }));
  };

  const handleRemoveTag = (id: string, tagToRemove: TagType) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, tags: m.tags.filter(t => t !== tagToRemove) };
      }
      return m;
    }));
  };

  const changePlaybackRate = (rate: number) => {
    if (player) {
      player.setPlaybackRate(rate);
      setState(prev => ({ ...prev, playbackRate: rate }));
    }
  };

  // --- Render ---

  if (isSetupMode) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-yellow-500 p-2 rounded-lg text-black">
              <Zap size={24} fill="currentColor" />
            </div>
            <h1 className="text-2xl font-bold text-white">EchoLoop</h1>
          </div>

          <form onSubmit={handleUrlSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-400 text-sm font-bold mb-2">YouTube URL</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-600" size={18} />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="https://youtube.com/watch?v=..."
                  autoFocus
                />
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const match = inputUrl.match(regExp);
                    const id = (match && match[2].length === 11) ? match[2] : null;
                    if (id) fetchSubtitles(id);
                    else alert("Please enter a valid YouTube URL first");
                  }}
                  disabled={isFetchingSubs}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 disabled:opacity-50"
                >
                  {isFetchingSubs ? (
                    'Fetching...'
                  ) : (
                    <>
                      <Download size={12} /> Auto-Fetch Subtitles
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-bold mb-2">Subtitles (VTT/SRT) - Optional</label>
              <textarea
                value={inputSubs}
                onChange={(e) => setInputSubs(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-300 h-32 focus:outline-none focus:border-yellow-500 transition-colors resize-none"
                placeholder="Paste WebVTT or SRT content here..."
              />
            </div>

            <button
              type="submit"
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Start Practice <Play size={18} fill="currentColor" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <button
              onClick={loadDemo}
              className="text-sm text-gray-500 hover:text-yellow-500 underline transition-colors"
            >
              No video? Try the Demo (TED Talk)
            </button>
            <p className="text-[10px] text-gray-600 mt-2">
              Note: Demo subtitles are only available for the first 25 seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Left: Player Area */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-yellow-500">
            <Zap fill="currentColor" />
            <span className="font-bold text-lg tracking-tight text-white">EchoLoop</span>
          </div>
          <button
            onClick={() => {
              if (confirm("Reset current session?")) {
                setIsSetupMode(true);
                setMarkers([]);
                setCurrentLoop(null);
              }
            }}
            className="text-gray-500 hover:text-white text-sm"
          >
            Change Video
          </button>
        </div>

        {/* Video Container */}
        <div className="flex-1 flex flex-col justify-center min-h-0">
          <VideoPlayer
            videoId={videoId}
            onReady={(p) => setPlayer(p)}
            onStateChange={(s) => setState(prev => ({ ...prev, ...s }))}
            currentSubtitle={getCurrentSubtitle()}
            playbackRate={state.playbackRate}
            forceShowSubtitle={subtitlesVisible || isPeekingSubs}
          />

          <Timeline
            duration={state.duration}
            currentTime={state.currentTime}
            markers={markers}
            onSeek={(t) => player?.seekTo(t, true)}
          />
        </div>

        {/* Controls */}
        <div className="h-20 flex items-center justify-between mt-4 bg-gray-900/50 rounded-xl px-6 border border-gray-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => state.isPlaying ? player?.pauseVideo() : player?.playVideo()}
              className="w-12 h-12 flex items-center justify-center bg-gray-100 text-black rounded-full hover:bg-white transition-colors"
            >
              {state.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
            </button>

            <div className="text-sm font-mono text-gray-400">
              {formatTime(state.currentTime)} / {formatTime(state.duration)}
            </div>

            {/* Subtitle Toggle (Moved Left) */}
            <button
              onClick={() => setSubtitlesVisible(!subtitlesVisible)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-4 ${subtitlesVisible || isPeekingSubs ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-gray-800 text-gray-400 border border-transparent'
                }`}
              title="Toggle Subtitles (or press 'S' to peek)"
            >
              {subtitlesVisible || isPeekingSubs ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>{subtitlesVisible ? 'SUBS ON' : 'SUBS OFF'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase mr-2">Speed</span>
            {[0.75, 1, 1.25].map(rate => (
              <button
                key={rate}
                onClick={() => changePlaybackRate(rate)}
                className={`
                    px-3 py-1 text-sm rounded-md font-medium transition-colors
                    ${state.playbackRate === rate ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}
                  `}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Sidebar */}
      <div className="w-96 bg-gray-900 border-l border-gray-800 p-6 flex flex-col shadow-xl z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-xl">Review Points</h2>
          <div className="flex gap-2">
            <span className="bg-blue-900/50 text-blue-300 text-[10px] px-2 py-1 rounded-full border border-blue-800/50" title="Total subtitles loaded">
              {subtitles.length} SUBS
            </span>
            <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-1 rounded-full border border-gray-700/50">
              {markers.length} MARKS
            </span>
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
          <p className="flex items-center gap-2 mb-1">
            <span className="w-12 text-right font-mono bg-gray-700 text-gray-300 rounded px-1">Space</span>
            <span>Mark confusion point</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="w-12 text-right font-mono bg-gray-700 text-gray-300 rounded px-1">S</span>
            <span>Peek subtitle</span>
          </p>
        </div>

        <MarkerList
          markers={markers}
          currentLoopId={currentLoop?.id || null}
          onPlayLoop={handlePlayLoop}
          onStopLoop={handleStopLoop}
          onDelete={handleDeleteMarker}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />
      </div>
    </div>
  );
}

export default App;