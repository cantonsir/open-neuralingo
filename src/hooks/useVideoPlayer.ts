import { useState, useRef, useEffect, useCallback } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { FocusedSegment, Marker, PlayerState, Subtitle, View } from '../types';
import { api } from '../db';
import { parseSubtitles } from '../utils';

interface UseVideoPlayerOptions {
  targetLanguage: string;
  subtitles: Subtitle[];
  view: View;
  setView: (view: View) => void;
  setSubtitles: (subtitles: Subtitle[]) => void;
}

export function useVideoPlayer({
  targetLanguage,
  subtitles,
  view,
  setView,
  setSubtitles,
}: UseVideoPlayerOptions) {
  const [videoId, setVideoId] = useState<string>('');
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isSetupMode, setIsSetupMode] = useState<boolean>(true);
  const [isFetchingSubs, setIsFetchingSubs] = useState(false);

  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    playbackRate: 1.0,
  });

  const [subtitlesVisible, setSubtitlesVisible] = useState<boolean>(false);
  const [isPeekingSubs, setIsPeekingSubs] = useState<boolean>(false);

  const [currentLoop, setCurrentLoop] = useState<Marker | null>(null);
  const [tempSegment, setTempSegment] = useState<{ start: number; end: number } | null>(null);
  const [pendingSegment, setPendingSegment] = useState<{ start: number; end: number } | null>(null);
  const [focusedSegment, setFocusedSegment] = useState<FocusedSegment | null>(null);

  const loopIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setFocusedSegment(null);
  }, [videoId]);

  // --- Loop Engine ---
  useEffect(() => {
    if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);

    if ((currentLoop || tempSegment) && state.isPlaying) {
      loopIntervalRef.current = window.setInterval(async () => {
        if (!player) return;
        const t = await player.getCurrentTime();

        // 1. One-Shot Segment Logic (Vocabulary Workbench)
        if (tempSegment) {
          if (t >= tempSegment.end) {
            player.pauseVideo();
            setTempSegment(null);
          }
          return;
        }

        // 2. Loop Logic (Practice Mode)
        if (currentLoop) {
          if (t >= currentLoop.end || t < currentLoop.start - 1) {
            player.seekTo(currentLoop.start, true);
          }
        }
      }, 50);
    }

    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
    };
  }, [currentLoop, tempSegment, state.isPlaying, player]);

  // --- Time Polling ---
  useEffect(() => {
    let interval: number;
    if (state.isPlaying && player) {
      interval = window.setInterval(async () => {
        const t = await player.getCurrentTime();
        setState(prev => ({ ...prev, currentTime: t }));
      }, 200);
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

  const changePlaybackRate = (rate: number) => {
    if (player) {
      player.setPlaybackRate(rate);
      setState(prev => ({ ...prev, playbackRate: rate }));
    }
  };

  const handlePrevSubtitle = async () => {
    if (!player || subtitles.length === 0) return;

    const t = await player.getCurrentTime();
    const currentIndex = subtitles.findIndex(s => t >= s.start && t < s.end);

    if (currentIndex !== -1) {
      const prevIndex = Math.max(0, currentIndex - 1);
      player.seekTo(subtitles[prevIndex].start, true);
    } else {
      const lastIndex = subtitles.length - 1;
      let targetIndex = -1;

      for (let i = lastIndex; i >= 0; i--) {
        if (subtitles[i].end <= t) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex !== -1) {
        player.seekTo(subtitles[targetIndex].start, true);
      }
    }
  };

  const handleNextSubtitle = async () => {
    if (!player || subtitles.length === 0) return;

    const t = await player.getCurrentTime();
    const nextSub = subtitles.find(s => s.start > t);

    if (nextSub) {
      player.seekTo(nextSub.start, true);
    }
  };

  const handlePlaySegment = async (start: number, end: number, targetVideoId?: string) => {
    if (targetVideoId && targetVideoId !== videoId) {
      setPendingSegment({ start, end });
      const shouldNavigate = view !== 'vocab';
      await fetchSubtitles(targetVideoId, shouldNavigate);
      if (shouldNavigate) setView('loop');
      return;
    }

    if (view !== 'loop' && view !== 'vocab') {
      if (videoId) {
        setPendingSegment({ start, end });
        setView('loop');
      } else {
        console.warn('No video loaded to play segment from');
      }
      return;
    }

    if (!player && videoId) {
      setPendingSegment({ start, end });
      return;
    }

    if (!player || typeof player.seekTo !== 'function' || typeof player.playVideo !== 'function') {
      console.warn('No video player available or player not ready');
      return;
    }

    try {
      setCurrentLoop(null);
      setTempSegment({ start, end });
      player.seekTo(start, true);
      player.playVideo();
    } catch (err) {
      console.warn('Failed to play segment:', err);
    }
  };

  useEffect(() => {
    if (!player || !pendingSegment) return;

    const { start, end } = pendingSegment;
    setPendingSegment(null);
    try {
      setCurrentLoop(null);
      setTempSegment({ start, end });
      player.seekTo(start, true);
      player.playVideo();
    } catch (err) {
      console.warn('Failed to play pending segment:', err);
    }
  }, [player, pendingSegment]);

  const getCurrentSubtitle = (): Subtitle | null => {
    return subtitles.find(
      s => state.currentTime >= s.start && state.currentTime <= s.end
    ) || null;
  };

  const fetchSubtitles = async (id: string, shouldNavigate: boolean = true) => {
    setIsFetchingSubs(true);
    let subtitlesFetched = false;
    let errorMessage = '';
    
    try {
      const response = await fetch(`/api/transcript?videoId=${id}&language=${targetLanguage}`);
      
      if (response.ok) {
        const data = await response.json();
        const parsed: Subtitle[] = data.map((item: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          start: item.start,
          end: item.start + item.duration,
          text: item.text
        }));
        setSubtitles(parsed);
        subtitlesFetched = true;
      } else {
        // Parse error response to provide specific feedback
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404 || errorData.error?.includes('No transcript')) {
          errorMessage = 'no_subtitles';
          console.warn(`[fetchSubtitles] No subtitles available for video ${id}`);
        } else {
          errorMessage = 'fetch_error';
          console.error(`[fetchSubtitles] Error fetching subtitles: ${response.status}`);
        }
        // Set empty subtitles - video can still load
        setSubtitles([]);
      }
    } catch (error) {
      console.error('[fetchSubtitles] Network/server error:', error);
      errorMessage = 'server_error';
      // Set empty subtitles - video can still load
      setSubtitles([]);
    }

    // Always proceed to load video (even without subtitles)
    setPlayer(null);
    setVideoId(id);
    setIsSetupMode(false);

    // Fetch video title
    let resolvedTitle = `YouTube Video (${id})`;
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        resolvedTitle = oembedData.title || resolvedTitle;
      }
    } catch (e) {
      // Silently fail - use fallback title
    }

    setVideoTitle(resolvedTitle);

    // Save to history
    api.saveToHistory({
      videoId: id,
      title: resolvedTitle,
      thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      watchedAt: Date.now(),
      wordsLearned: 0
    });

    // Navigate to loop view
    if (shouldNavigate) {
      setView('loop');
    }

    setIsFetchingSubs(false);

    // Return status for UI feedback
    return {
      success: subtitlesFetched,
      errorType: errorMessage,
      videoId: id,
      title: resolvedTitle
    };
  };

  const loadVideo = (id: string, subText: string) => {
    setVideoId(id);
    if (subText.trim()) {
      setSubtitles(parseSubtitles(subText));
    }
    setVideoTitle(`YouTube Video (${id})`);
    setIsSetupMode(false);
  };

  return {
    videoId,
    videoTitle,
    setVideoId,
    inputUrl,
    setInputUrl,
    isSetupMode,
    setIsSetupMode,
    isFetchingSubs,
    player,
    setPlayer,
    state,
    setState,
    subtitlesVisible,
    setSubtitlesVisible,
    isPeekingSubs,
    setIsPeekingSubs,
    currentLoop,
    setCurrentLoop,
    tempSegment,
    setTempSegment,
    pendingSegment,
    setPendingSegment,
    focusedSegment,
    setFocusedSegment,
    handlePlayLoop,
    handleStopLoop,
    changePlaybackRate,
    handlePrevSubtitle,
    handleNextSubtitle,
    handlePlaySegment,
    getCurrentSubtitle,
    fetchSubtitles,
    loadVideo,
  };
}
