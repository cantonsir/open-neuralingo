import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { YouTubePlayer } from 'react-youtube';
import { Play, Pause, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';

import VideoPlayer from './components/VideoPlayer';
import MarkerList from './components/MarkerList';
import Timeline from './components/Timeline';
import Sidebar from './components/Sidebar';
import HomeView from './components/HomeView';
import HistoryView from './components/HistoryView';
import DashboardView from './components/DashboardView';
import SettingsPanel from './components/SettingsPanel';
import { Marker, Subtitle, PlayerState, TagType } from './types';

import { parseSubtitles, formatTime } from './utils';
import VocabularyManager from './components/VocabularyManager';
import FlashcardPractice from './components/FlashcardPractice';
import LearningHome from './components/LearningHome';
import CourseDashboard from './components/CourseDashboard';
import LearningSession from './components/LearningSession';
import SelfAssessment from './components/SelfAssessment';
import MiniTest from './components/MiniTest';
import { api, GoalVideo, GoalVideoDetail } from './db';

type View = 'home' | 'loop' | 'vocab' | 'flashcards' | 'history' | 'learning' | 'assessment' | 'minitest';
type Theme = 'dark' | 'light';

function App() {
  const [videoId, setVideoId] = useState<string>('');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [inputSubs, setInputSubs] = useState<string>('');
  const [isSetupMode, setIsSetupMode] = useState<boolean>(true);
  const [showManualSetup, setShowManualSetup] = useState<boolean>(false);

  // --- Theme Logic ---
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // --- Target Language (for learning) ---
  const [targetLanguage, setTargetLanguage] = useState<string>(() => {
    return localStorage.getItem('targetLanguage') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('targetLanguage', targetLanguage);
  }, [targetLanguage]);

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
  const [view, setView] = useState<View>('loop');

  const [tempSegment, setTempSegment] = useState<{ start: number, end: number } | null>(null);
  const [pendingSegment, setPendingSegment] = useState<{ start: number, end: number } | null>(null);

  const [savedCards, setSavedCards] = useState<Marker[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Learning Section navigation state
  const [learningView, setLearningView] = useState<'home' | 'course' | 'lesson'>('home');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number>(0);
  const [selectedSegmentData, setSelectedSegmentData] = useState<{
    videoId: string;
    subtitle: string[];
    startTime: number;
    endTime: number;
  } | null>(null);

  // Assessment data cache (loaded once)
  const [assessmentProfile, setAssessmentProfile] = useState<any>(null);
  const [assessmentResults, setAssessmentResults] = useState<any[] | null>(null);
  const [assessmentLoaded, setAssessmentLoaded] = useState(false);

  // Learning goals cache (loaded once)
  const [learningGoals, setLearningGoals] = useState<GoalVideo[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  // Course details cache (GoalVideoDetail by goalId)
  const [goalDetailsCache, setGoalDetailsCache] = useState<Record<string, GoalVideoDetail>>({});

  // Key to force MiniTest remount (clears cache on retake)
  const [miniTestKey, setMiniTestKey] = useState(0);

  // Load all cached data once on app mount
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        // Load all data in parallel
        const [profileRes, resultsRes, goals] = await Promise.all([
          fetch('/api/assessment/profile'),
          fetch('/api/assessment/results'),
          api.fetchGoals()
        ]);

        // Assessment profile
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setAssessmentProfile(profile);
        }

        // Assessment results
        if (resultsRes.ok) {
          const results = await resultsRes.json();
          if (results && results.length > 0) {
            setAssessmentResults(results);
          }
        }

        // Learning goals
        setLearningGoals(goals);
      } catch (error) {
        console.error('Failed to load cached data:', error);
      } finally {
        setAssessmentLoaded(true);
        setGoalsLoaded(true);
      }
    };
    loadCachedData();
  }, []);

  // Callback to refresh assessment data after updates
  const refreshAssessmentData = useCallback(async () => {
    try {
      const [profileRes, resultsRes] = await Promise.all([
        fetch('/api/assessment/profile'),
        fetch('/api/assessment/results')
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setAssessmentProfile(profile);
      }

      if (resultsRes.ok) {
        const results = await resultsRes.json();
        setAssessmentResults(results && results.length > 0 ? results : null);
      }
    } catch (error) {
      console.error('Failed to refresh assessment data:', error);
    }
  }, []);

  // Update goal details cache
  const refreshGoalDetails = useCallback(async (goalId: string) => {
    try {
      const details = await api.fetchGoal(goalId);
      if (details) {
        setGoalDetailsCache(prev => ({ ...prev, [goalId]: details }));
      }
    } catch (e) {
      console.error("Failed to refresh goal details", e);
    }
  }, []);

  // Load saved cards on mount
  useEffect(() => {
    const loadCards = async () => {
      // 1. Migration: Check localStorage
      const local = localStorage.getItem('saved_flashcards');
      if (local) {
        try {
          const localCards: Marker[] = JSON.parse(local);
          console.log("Migrating cards to DB...", localCards.length);
          for (const c of localCards) {
            await api.saveCard(c);
          }
          localStorage.removeItem('saved_flashcards');
        } catch (e) {
          console.error("Migration failed", e);
        }
      }

      // 2. Load from DB
      const cards = await api.fetchCards();
      setSavedCards(cards);
    };
    loadCards();
  }, []);

  // Save cards handler
  const handleSaveToDeck = async (marker: Marker) => {
    // Optimistic UI update
    setSavedCards(prev => {
      if (prev.some(c => c.id === marker.id)) return prev;
      return [...prev, marker];
    });

    try {
      await api.saveCard(marker);
    } catch (e) {
      console.error("Failed to save card to DB", e);
      // Revert if failed (optional, but good practice)
      setSavedCards(prev => prev.filter(c => c.id !== marker.id));
      alert("Failed to save to database");
    }
  };

  const handleDeleteFromDeck = async (id: string) => {
    setSavedCards(prev => prev.filter(c => c.id !== id));
    try {
      await api.deleteCard(id);
    } catch (e) {
      console.error("Failed to delete card", e);
      alert("Failed to delete from database");
      // Revert logic could go here (fetching again)
      const cards = await api.fetchCards();
      setSavedCards(cards);
    }
  };

  const handleUpdateCard = async (id: string, updates: Partial<Marker>) => {
    setSavedCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    try {
      await api.updateCard(id, updates);
    } catch (e) {
      console.error("Failed to update card", e);
    }
  };

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



  const [isFetchingSubs, setIsFetchingSubs] = useState(false);

  const fetchSubtitles = async (id: string, shouldNavigate: boolean = true) => {
    setIsFetchingSubs(true);
    try {
      const response = await fetch(`/api/transcript?videoId=${id}&language=${targetLanguage}`);
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
      setPlayer(null); // Reset player - new one will be set on onReady
      setVideoId(id);
      setIsSetupMode(false); // Auto-start if successful

      // Fetch video title from YouTube oEmbed and save to history
      let videoTitle = `YouTube Video (${id})`;
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          videoTitle = oembedData.title || videoTitle;
        }
      } catch (e) {
        // Silently fail, use default title
      }

      api.saveToHistory({
        videoId: id,
        title: videoTitle,
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        watchedAt: Date.now(),
        wordsLearned: 0
      });

      if (shouldNavigate) {
        setView('loop'); // Navigate to practice view only if requested
      }
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
        videoId: videoId, // Capture current video ID
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
      // K / P: Toggle Play/Pause
      if (e.key === 'k' || e.key === 'K' || e.key === 'p') {
        if (state.isPlaying) player?.pauseVideo();
        else player?.playVideo();
      }

      // Arrows for Sentence Navigation
      if (e.key === 'ArrowLeft') {
        handlePrevSubtitle();
      }
      if (e.key === 'ArrowRight') {
        handleNextSubtitle();
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

  // NOTE: Pending segment handling is now done directly in the VideoPlayer onReady callback
  // to ensure proper timing before YouTube autoplay starts.


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
          // If we passed the end, seek back to start
          if (t >= currentLoop.end || t < currentLoop.start - 1) {
            player.seekTo(currentLoop.start, true);
          }
        }
      }, 50); // Check faster (50ms) for better precision
    }

    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
    };
  }, [currentLoop, tempSegment, state.isPlaying, player]);

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

  const handleToggleWord = (id: string, wordIndex: number) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id) {
        const indices = new Set(m.misunderstoodIndices || []);
        if (indices.has(wordIndex)) indices.delete(wordIndex);
        else indices.add(wordIndex);
        return { ...m, misunderstoodIndices: Array.from(indices) };
      }
      return m;
    }));
  };

  const handleToggleRange = (id: string, start: number, end: number) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id) {
        const currentIndices = new Set(m.misunderstoodIndices || []);
        const range = [];
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          range.push(i);
        }

        // Logic: If ANY word in the range is NOT selected, select the whole range.
        // If ALL words in the range are ALREADY selected, deselect the whole range.
        const allSelected = range.every(idx => currentIndices.has(idx));

        if (allSelected) {
          range.forEach(idx => currentIndices.delete(idx));
        } else {
          range.forEach(idx => currentIndices.add(idx));
        }

        return { ...m, misunderstoodIndices: Array.from(currentIndices) };
      }
      return m;
    }));
  };

  const handleRemoveWord = (wordToRemove: string) => {
    setMarkers(prev => prev.map(m => {
      if (!m.subtitleText || !m.misunderstoodIndices?.length) return m;

      const words = m.subtitleText.trim().split(/\s+/).filter(w => w.length > 0);
      // We need to find indices where the word matches 'wordToRemove'
      // Note: This relies on exact string matching used in the Manager
      const newIndices = m.misunderstoodIndices.filter(index => {
        const w = words[index];
        return w !== wordToRemove;
      });

      if (newIndices.length !== m.misunderstoodIndices.length) {
        return { ...m, misunderstoodIndices: newIndices };
      }
      return m;
    }));
  };

  const handleUpdateVocabData = (markerId: string, index: number, field: 'definition' | 'notes', value: string) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === markerId) {
        const currentVocab = m.vocabData || {};
        const currentItem = currentVocab[index] || { definition: '', notes: '' };

        return {
          ...m,
          vocabData: {
            ...currentVocab,
            [index]: { ...currentItem, [field]: value }
          }
        };
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

  const handlePrevSubtitle = async () => {
    if (!player || subtitles.length === 0) return;

    const t = await player.getCurrentTime();
    // Find current or closest past subtitle
    const currentIndex = subtitles.findIndex(s => t >= s.start && t < s.end);

    if (currentIndex !== -1) {
      // Strictly go to the previous subtitle as requested
      const prevIndex = Math.max(0, currentIndex - 1);
      player.seekTo(subtitles[prevIndex].start, true);
    } else {
      // If we are in a gap, find the last subtitle that ended before now
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
    // Find subtitle that starts after current time
    const nextSub = subtitles.find(s => s.start > t);

    if (nextSub) {
      player.seekTo(nextSub.start, true);
    }
  };

  const handlePlaySegment = async (start: number, end: number, targetVideoId?: string) => {
    // If there's a target video and we need to switch
    if (targetVideoId && targetVideoId !== videoId) {
      // Store segment to play when player is ready
      setPendingSegment({ start, end });
      // If in vocab mode, stay there. Otherwise go to loop.
      const shouldNavigate = view !== 'vocab';
      await fetchSubtitles(targetVideoId, shouldNavigate);
      if (shouldNavigate) setView('loop');
      return;
    }

    // If we're not on the loop OR vocab view, navigate to loop view
    if (view !== 'loop' && view !== 'vocab') {
      if (videoId) {
        setPendingSegment({ start, end });
        setView('loop');
      } else {
        console.warn('No video loaded to play segment from');
      }
      return;
    }

    // If no player yet but we have a videoId, set pending segment and wait for player
    if (!player && videoId) {
      setPendingSegment({ start, end });
      return;
    }

    // If no player and no video, we can't play
    if (!player || typeof player.seekTo !== 'function' || typeof player.playVideo !== 'function') {
      console.warn('No video player available or player not ready');
      return;
    }

    // Player ready - just seek and play
    try {
      setCurrentLoop(null);
      setTempSegment({ start, end });
      player.seekTo(start, true);
      player.playVideo();
    } catch (err) {
      console.warn('Failed to play segment:', err);
    }
  };

  // --- Render ---

  // Handler for manual URL submission from HomeView
  const handleManualSubmit = (id: string, subs: string) => {
    setVideoId(id);
    if (subs.trim()) {
      setSubtitles(parseSubtitles(subs));
    }
    setView('loop');
  };

  // Handler for auto-fetch from HomeView
  const handleFetchFromHome = async (id: string) => {
    await fetchSubtitles(id);
    setView('loop');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors">
      {/* Left Sidebar */}
      <Sidebar
        view={view}
        setView={setView}
        theme={theme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        savedCardsCount={savedCards.length}
        markersCount={markers.length}
        videoId={videoId}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        toggleTheme={toggleTheme}
        targetLanguage={targetLanguage}
        onLanguageChange={setTargetLanguage}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* PERSISTENT PLAYER WRAPPER */}
          {/* We keep this mounted always if we have a videoId (or even if not, to be safe, but usually videoId required) */}
          {/* We use a strategy: precise CSS positioning or Portal?
            Let's use a "Slot" approach. We render the player here, but hidden if not needed.
            When in Loop View, we want it to visually be in that specific spot.
            
            Actually, let's try a Portal properly later if needed. For now:
            RENDER IT HIDDEN if view != 'loop'.
            RENDER IT VISIBLE if view == 'loop'.
            
            BUT it needs to be IN THE FLOW for 'loop' view.
            
            Let's just use absolute positioning 'off screen' when hidden,
            and 'inset-0' or similar when visible?
            
            No, 'loop' view uses Flexbox layout.
            
            Let's try this:
            We render `LoopViewContainer` that is ALWAYS mounted but `display: none` when not active?
            Yes, that's the standard way to keep state.
        */}

          {/* Loop View - ALWAYS MOUNTED, but hidden if not active */}
          <div className={`flex-1 flex flex-col overflow-hidden ${view === 'loop' ? 'flex' : 'hidden'}`}>
            {/* Persistent URL Bar at Top */}
            <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
              <div className="flex items-center gap-3 max-w-3xl">
                <div className="relative flex-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                    placeholder="Paste YouTube URL here..."
                  />
                </div>
                <button
                  onClick={() => {
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const match = inputUrl.match(regExp);
                    const id = match && match[2].length === 11 ? match[2] : null;
                    if (id) handleFetchFromHome(id);
                    else alert('Please enter a valid YouTube URL');
                  }}
                  disabled={isFetchingSubs || !inputUrl.trim()}
                  className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold py-2.5 px-5 rounded-lg transition-all shadow-md shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
                >
                  {isFetchingSubs ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                      Load Video
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Empty State */}
              {!videoId ? (
                <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-50 to-yellow-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
                  <div className="text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Video Loaded</h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Paste a YouTube URL above and click <strong>Load Video</strong> to start practicing.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Video Area */}
                  <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    {/* Video Container */}
                    <div className="flex-1 flex flex-col justify-center min-h-0">
                      <VideoPlayer
                        videoId={videoId}
                        onReady={(p) => {
                          setPlayer(p);
                          // Handle pending segment immediately when player is ready
                          // Note: this might fire multiple times if component re-renders but usually onReady is once per videoId change
                        }}
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
                    <div className="h-20 flex items-center justify-between mt-4 bg-white/80 dark:bg-gray-900/50 rounded-xl px-6 border border-gray-200 dark:border-gray-800 transition-colors">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => state.isPlaying ? player?.pauseVideo() : player?.playVideo()}
                          className="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg shadow-yellow-500/25"
                        >
                          {state.isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-0.5" />}
                        </button>

                        <div className="flex items-center gap-1 mx-2">
                          <button
                            onClick={handlePrevSubtitle}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Previous Sentence"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={handleNextSubtitle}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Next Sentence"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>

                        <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
                          {formatTime(state.currentTime)} / {formatTime(state.duration)}
                        </div>

                        {/* Subtitle Toggle */}
                        <button
                          onClick={() => setSubtitlesVisible(!subtitlesVisible)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-4 ${subtitlesVisible || isPeekingSubs ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/50' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent'
                            }`}
                          title="Toggle Subtitles (or press 'S' to peek')"
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
                                ${state.playbackRate === rate ? 'bg-yellow-500 text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:text-white'}
                              `}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Panel: Review Points */}
                  <div className="w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col shadow-xl transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-bold text-xl text-gray-900 dark:text-white">Review Points</h2>
                      <div className="flex gap-2">
                        <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-[10px] px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800/50" title="Total subtitles loaded">
                          {subtitles.length} SUBS
                        </span>
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700/50">
                          {markers.length} MARKS
                        </span>
                      </div>
                    </div>

                    <MarkerList
                      markers={markers}
                      currentLoopId={currentLoop?.id || null}
                      onPlayLoop={handlePlayLoop}
                      onStopLoop={handleStopLoop}
                      onDelete={handleDeleteMarker}
                      onAddTag={handleAddTag}
                      onRemoveTag={handleRemoveTag}
                      onToggleWord={handleToggleWord}
                      onToggleRange={handleToggleRange}
                      onPlayOnce={handlePlaySegment}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dashboard View */}
          {view === 'home' && (
            <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
              <DashboardView
                onPlayVideo={(videoId) => fetchSubtitles(videoId)}
                onNavigate={(v) => setView(v as View)}
                savedCardsCount={savedCards.length}
                markersCount={markers.length}
              />
            </div>
          )}

          {/* History View */}
          {view === 'history' && (
            <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
              <HistoryView
                onPlayVideo={(videoId) => fetchSubtitles(videoId)}
                savedCardsCount={savedCards.length}
                markersCount={markers.length}
              />
            </div>
          )}

          {/* Flashcards View */}
          {view === 'flashcards' && (
            <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
              <FlashcardPractice
                savedCards={savedCards}
                onExit={() => setView('home')}
                onPlayAudio={handlePlaySegment}
              />
            </div>
          )}

          {/* Learning Section - 3 Level Hierarchy */}
          {view === 'learning' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Level 1: Goal Videos List */}
              {learningView === 'home' && (
                <LearningHome
                  defaultLanguage={targetLanguage}
                  cachedGoals={learningGoals}
                  isLoaded={goalsLoaded}
                  onGoalsUpdate={setLearningGoals}
                  onSelectGoal={(goalId) => {
                    setSelectedGoalId(goalId);
                    setLearningView('course');
                  }}
                />
              )}

              {/* Level 2: Course Dashboard (Segments) */}
              {learningView === 'course' && selectedGoalId && (
                <CourseDashboard
                  goalId={selectedGoalId}
                  cachedGoal={goalDetailsCache[selectedGoalId]}
                  onCacheUpdate={refreshGoalDetails}
                  onBack={() => {
                    setLearningView('home');
                    setSelectedGoalId(null);
                  }}
                  onWatchVideo={async (videoId) => {
                    // Navigate to Listen & Loop with this video
                    await fetchSubtitles(videoId);
                    setView('loop');
                  }}
                  onStartLesson={async (goalId, segmentIndex, videoId, startTime, endTime) => {
                    setSelectedSegmentIndex(segmentIndex);

                    // Fetch segment sentences from API
                    try {
                      const data = await api.fetchSegmentSentences(goalId, segmentIndex);
                      setSelectedSegmentData({
                        videoId,
                        subtitle: data.sentences || [],
                        startTime,
                        endTime
                      });
                      setLearningView('lesson');
                    } catch (error) {
                      console.error('Failed to load segment:', error);
                    }
                  }}
                />
              )}

              {/* Level 3: Lesson Drills */}
              {learningView === 'lesson' && selectedGoalId && selectedSegmentData && (
                <LearningSession
                  goalId={selectedGoalId}
                  videoId={selectedSegmentData.videoId}
                  segmentIndex={selectedSegmentIndex}
                  segmentSubtitle={selectedSegmentData.subtitle}
                  segmentStartTime={selectedSegmentData.startTime}
                  segmentEndTime={selectedSegmentData.endTime}
                  onExit={() => {
                    setLearningView('course');
                    setSelectedSegmentData(null);
                  }}
                  onComplete={() => {
                    refreshGoalDetails(selectedGoalId);
                    setLearningView('course');
                    setSelectedSegmentData(null);
                  }}
                />
              )}
            </div>
          )}

          {/* Vocabulary Manager View */}
          {view === 'vocab' && (
            <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
              <VocabularyManager
                markers={markers}
                savedCards={savedCards}
                onRemoveWord={handleRemoveWord}
                onUpdateVocabData={handleUpdateVocabData}
                onPlaySegment={handlePlaySegment}
                onSaveToDeck={handleSaveToDeck}
                onDeleteCard={handleDeleteFromDeck}
                onUpdateCard={handleUpdateCard}
                onDiscardSessionMarker={handleDeleteMarker}
              />
            </div>
          )}

          {/* Self-Assessment View */}
          {view === 'assessment' && (
            <SelfAssessment
              onComplete={() => setView('home')}
              onStartTest={() => {
                setMiniTestKey(prev => prev + 1); // Force fresh component
                setView('minitest');
              }}
              cachedProfile={assessmentProfile}
              cachedResults={assessmentResults}
              isLoaded={assessmentLoaded}
              onProfileUpdate={setAssessmentProfile}
              onResultsUpdate={setAssessmentResults}
            />
          )}

          {/* Mini-Test View */}
          {view === 'minitest' && (
            <MiniTest
              key={miniTestKey}
              onComplete={() => {
                refreshAssessmentData();
                setView('assessment');
              }}
              onBack={() => setView('assessment')}
            />
          )}

        </div>
      </div>
    </div>
  );
}

export default App;