import React, { useState, useEffect, useRef, useCallback } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { Play, Pause, RotateCcw, Volume2, Settings, Download, Search, Zap, Eye, EyeOff, Sun, Moon, ChevronLeft, ChevronRight, Keyboard } from 'lucide-react';

import VideoPlayer from './components/VideoPlayer';
import MarkerList from './components/MarkerList';
import ShortcutsPage from './components/ShortcutsPage';
import Timeline from './components/Timeline';
import { Marker, Subtitle, PlayerState, TagType } from './types';

import { parseSubtitles, parseYouTubeXml, parseTime, formatTime } from './utils';
import VocabularyManager from './components/VocabularyManager';
import FlashcardPractice from './components/FlashcardPractice';
import { api } from './db';

type View = 'loop' | 'vocab' | 'shortcuts' | 'flashcards';
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

  const [savedCards, setSavedCards] = useState<Marker[]>([]);

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
      setVideoId(id);
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

  // --- Render ---

  if (isSetupMode) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-yellow-500 p-2 rounded-lg text-black">
              <Zap size={24} fill="currentColor" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EchoLoop</h1>
          </div>

          <form onSubmit={handleUrlSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-600 dark:text-gray-400 text-sm font-bold mb-2">YouTube URL</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400 dark:text-gray-600" size={18} />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="https://youtube.com/watch?v=..."
                  autoFocus
                />
              </div>
              <div className="mt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowManualSetup(!showManualSetup)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 underline"
                >
                  {showManualSetup ? 'Hide Manual Options' : 'Enter Subtitles Manually'}
                </button>

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
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded border border-blue-200 dark:border-blue-500/20 disabled:opacity-50"
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

            {showManualSetup && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="mb-6">
                  <label className="block text-gray-600 dark:text-gray-400 text-sm font-bold mb-2">Subtitles (VTT/SRT) - Optional</label>
                  <textarea
                    value={inputSubs}
                    onChange={(e) => setInputSubs(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-900 dark:text-gray-300 h-32 focus:outline-none focus:border-yellow-500 transition-colors resize-none"
                    placeholder="Paste WebVTT or SRT content here..."
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Start Practice <Play size={18} fill="currentColor" />
                  </button>
                </div>
              </div>
            )}
          </form>


        </div>
      </div>
    );
  }

  const handlePlaySegment = async (start: number, end: number, targetVideoId?: string) => {
    if (!player) return;

    // Check if we need to switch video
    if (targetVideoId && targetVideoId !== videoId) {
      if (confirm("This card is from a different video. Switch video?")) {
        await fetchSubtitles(targetVideoId); // This sets videoId and subtitles
        // After state update, we need to wait/hook into ready, but for now simple seek after load might fail
        // We'll rely on onReady or effect. 
        // A better way for immediate robust switch is simple:
        // Just set state, and maybe use a temp effect or just let user play.
        // For now, let's just switch and let auto-play happen if we can.
        // React state update is async, so we can't seek immediately on the *old* player instance easily for the *new* video.
        // But react-youtube handles ID change.

        // We set a flag or temp segment to auto-play once loaded?
        setTempSegment({ start, end });
        // The player will reload. We need logic in onReady or useEffect to seek if tempSegment is set.
      }
      return;
    }

    setCurrentLoop(null); // Ensure strict loop is off. CRITICAL: Do not set currentLoop, or it will loop!
    setTempSegment({ start, end });
    player.seekTo(start, true);
    player.playVideo();
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden flex-col transition-colors">
      {/* Top Navigation Bar */}
      <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shrink-0 z-20 transition-colors">
        <div className="flex items-center gap-2 text-yellow-500">
          <Zap fill="currentColor" />
          <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">EchoLoop</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('loop')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'loop' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Practice
            </button>
            <button
              onClick={() => setView('vocab')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'vocab' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Vocabulary
            </button>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            onClick={() => {
              if (confirm("Reset current session?")) {
                setIsSetupMode(true);
                setMarkers([]);
                setCurrentLoop(null);
              }
            }}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm"
          >
            Change Video
          </button>

          <button
            onClick={() => setView('flashcards')}
            className={`p-2 rounded-lg transition-colors ${view === 'flashcards' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
            title="Flashcards (Practice)"
          >
            <Zap size={20} />
          </button>
          <button
            onClick={() => setView('shortcuts')}
            className={`p-2 rounded-lg transition-colors ${view === 'shortcuts' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
            title="Keyboard Shortcuts"
          >
            <Keyboard size={20} />
          </button>
        </div>
      </div>



      <div className="flex-1 flex overflow-hidden relative">
        {/* Modal / Overlay Views */}
        {view === 'shortcuts' && (
          <div className="absolute inset-0 z-50 bg-gray-50 dark:bg-gray-950">
            <ShortcutsPage onBack={() => setView('loop')} />
          </div>
        )}

        {view === 'flashcards' && (
          <div className="absolute inset-0 z-50 bg-gray-50 dark:bg-gray-950">
            <FlashcardPractice
              savedCards={savedCards}
              onExit={() => setView('loop')}
              onPlayAudio={handlePlaySegment}
            />
          </div>
        )}

        {/* Vocabulary Manager Overlay */}
        {view === 'vocab' && (
          <div className="absolute inset-0 z-50 bg-gray-50 dark:bg-gray-950">
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

        {/* Main Player Area (Always Mounted, Hidden when 'vocab' is active to keep audio) */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">

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
          <div className="h-20 flex items-center justify-between mt-4 bg-white/80 dark:bg-gray-900/50 rounded-xl px-6 border border-gray-200 dark:border-gray-800 transition-colors">
            <div className="flex items-center gap-4">
              <button
                onClick={() => state.isPlaying ? player?.pauseVideo() : player?.playVideo()}
                className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-white text-black rounded-full hover:bg-gray-200 dark:hover:bg-gray-200 transition-colors shadow-sm"
              >
                {state.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
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

        {/* Right: Sidebar (Hide in Vocab Mode, Keep mounted for Shortcuts to preserve scroll) */}
        <div className="w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col shadow-xl z-0 transition-colors">
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
      </div>

    </div>
  );
}

export default App;