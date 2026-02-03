import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, Volume2, ArrowLeft, Calendar, Zap, Trophy, Clock, Settings, Timer, RefreshCw } from 'lucide-react';
import { Marker, IntervalsPreview, SrsStats, SortOption, ReviewRating, LearningStatus, CardState } from '../../types';
import { FlashcardModule, api } from '../../db';

interface FlashcardPracticeProps {
    module: FlashcardModule;
    savedCards: Marker[];
    onExit: () => void;
    onPlayAudio: (start: number, end: number, videoId?: string) => void;
    previewMode?: boolean;
}

// Local storage keys
const getSortKey = (module: string) => `flashcard-sort-${module}`;
const getNewLimitKey = (module: string) => `flashcard-new-limit-${module}`;

// TTS utilities for reading module
const speakText = (text: string, lang: string = 'en-US') => {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;  // Slightly slower for clarity
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
    }
};

const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
};

const FlashcardPractice: React.FC<FlashcardPracticeProps> = ({ module, savedCards, onExit, onPlayAudio, previewMode = false }) => {
    const [dueCards, setDueCards] = useState<Marker[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stats, setStats] = useState<SrsStats | null>(null);
    const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
    const [isSessionComplete, setIsSessionComplete] = useState(false);
    
    // Settings
    const [sortOption, setSortOption] = useState<SortOption>(() => {
        const saved = localStorage.getItem(getSortKey(module));
        return (saved as SortOption) || 'due_first';
    });
    const [newCardsLimit, setNewCardsLimit] = useState<number | undefined>(() => {
        const saved = localStorage.getItem(getNewLimitKey(module));
        return saved ? parseInt(saved, 10) : undefined;
    });
    const [showSettings, setShowSettings] = useState(false);
    
    // Waiting for learning cards state
    const [isWaiting, setIsWaiting] = useState(false);
    const [learningStatus, setLearningStatus] = useState<LearningStatus | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate progress for the top bar
    const progress = dueCards.length > 0 ? ((currentIndex) / dueCards.length) * 100 : 0;
    const currentCard = dueCards[currentIndex];

    const getCardWords = (card?: Marker) => card?.subtitleText?.trim().split(/\s+/).filter(w => w.length > 0) || [];

    const getGroupedItems = (card?: Marker) => {
        if (!card) return [] as { indices: number[]; text: string; mainIndex: number; isPhrase: boolean }[];
        const words = getCardWords(card);
        const markedIndices = card.misunderstoodIndices || [];
        if (markedIndices.length === 0) return [];

        const grouped: { indices: number[]; text: string; mainIndex: number; isPhrase: boolean }[] = [];
        const sorted = [...markedIndices].sort((a, b) => a - b);
        let currentGroup: number[] = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === sorted[i - 1] + 1) {
                currentGroup.push(sorted[i]);
            } else {
                const text = currentGroup.map(idx => words[idx] || '').join(' ');
                grouped.push({
                    indices: currentGroup,
                    text,
                    mainIndex: currentGroup[0],
                    isPhrase: currentGroup.length > 1
                });
                currentGroup = [sorted[i]];
            }
        }

        const text = currentGroup.map(idx => words[idx] || '').join(' ');
        grouped.push({
            indices: currentGroup,
            text,
            mainIndex: currentGroup[0],
            isPhrase: currentGroup.length > 1
        });

        return grouped;
    };

    const renderHighlightedSentence = (card?: Marker) => {
        if (!card?.subtitleText) return null;
        const words = getCardWords(card);
        const markedIndices = card.misunderstoodIndices || [];
        return words.map((word, i) => {
            const isMarked = markedIndices.includes(i);
            const isPhrasePart = isMarked && (markedIndices.includes(i - 1) || markedIndices.includes(i + 1));

            if (isMarked) {
                const colorClass = isPhrasePart
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';

                const dotClass = isPhrasePart ? 'bg-green-500' : 'bg-red-500';

                return (
                    <span key={i} className={`inline-block mx-1 px-1.5 rounded relative border ${colorClass}`}>
                        {word}
                        <span className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full translate-x-1/2 -translate-y-1/2 border border-white dark:border-gray-900 ${dotClass}`}></span>
                    </span>
                );
            }
            return <span key={i} className="mx-1">{word}</span>;
        });
    };

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem(getSortKey(module), sortOption);
    }, [sortOption, module]);

    useEffect(() => {
        if (newCardsLimit !== undefined) {
            localStorage.setItem(getNewLimitKey(module), String(newCardsLimit));
        } else {
            localStorage.removeItem(getNewLimitKey(module));
        }
    }, [newCardsLimit, module]);

    // Load due cards
    const loadDueCards = useCallback(async (includePending: boolean = false) => {
        if (previewMode) {
            setDueCards(savedCards);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const [cards, srsStats, learnStatus] = await Promise.all([
                api.fetchDueCards(module, true, sortOption, newCardsLimit, includePending),
                api.fetchSrsStats(module),
                api.fetchLearningStatus(module)
            ]);
            
            // Filter to only cards with marked words
            const validCards = cards.filter(c => c.misunderstoodIndices && c.misunderstoodIndices.length > 0);
            setDueCards(validCards);
            setStats(srsStats);
            setLearningStatus(learnStatus);
            
            // Check if we need to wait for learning cards (only if not forcing pending)
            if (!includePending && validCards.length === 0 && learnStatus.pendingCount > 0) {
                setIsWaiting(true);
                if (learnStatus.nextDueIn !== null) {
                    setCountdown(learnStatus.nextDueIn);
                }
            } else {
                setIsWaiting(false);
                setCountdown(null);
                // Reset index when loading new cards
                setCurrentIndex(0);
                setIsFlipped(false);
            }
        } catch (error) {
            console.error('Failed to load due cards:', error);
            setDueCards([]);
        }
        setIsLoading(false);
    }, [module, previewMode, savedCards, sortOption, newCardsLimit]);

    // Initial load
    useEffect(() => {
        loadDueCards();
    }, [loadDueCards]);

    // Countdown timer for waiting state
    useEffect(() => {
        if (isWaiting && countdown !== null && countdown > 0) {
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev === null || prev <= 1) {
                        // Time's up! Reload cards
                        loadDueCards();
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        
        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
            }
        };
    }, [isWaiting, countdown, loadDueCards]);

    // TTS cleanup on unmount
    useEffect(() => {
        return () => {
            stopSpeaking();
        };
    }, []);

    const handlePlayAudio = useCallback(() => {
        if (currentCard) {
            onPlayAudio(currentCard.start, currentCard.end, currentCard.videoId);
        }
    }, [currentCard, onPlayAudio]);

    const handleReview = async (rating: ReviewRating) => {
        if (!currentCard || isSubmitting || previewMode) {
            // In preview mode, just advance
            handleNext();
            return;
        }

        setIsSubmitting(true);
        try {
            await api.submitReview(module, currentCard.id, rating);
            
            // Update session stats
            setSessionStats(prev => ({
                reviewed: prev.reviewed + 1,
                again: prev.again + (rating === 'again' ? 1 : 0),
                hard: prev.hard + (rating === 'hard' ? 1 : 0),
                good: prev.good + (rating === 'good' ? 1 : 0),
                easy: prev.easy + (rating === 'easy' ? 1 : 0),
            }));
            
            handleNext();
        } catch (error) {
            console.error('Failed to submit review:', error);
        }
        setIsSubmitting(false);
    };

    const handleNext = async () => {
        if (currentIndex < dueCards.length - 1) {
            setIsFlipped(false);
            setCurrentIndex(prev => prev + 1);
        } else {
            // Check for more learning cards
            const learnStatus = await api.fetchLearningStatus(module);
            setLearningStatus(learnStatus);
            
            if (learnStatus.pendingCount > 0) {
                // There are learning cards waiting
                setIsWaiting(true);
                if (learnStatus.nextDueIn !== null) {
                    setCountdown(learnStatus.nextDueIn);
                }
            } else {
                // Session complete
                setIsSessionComplete(true);
            }
        }
    };

    const handleContinueNow = () => {
        // User clicked "Check Now" - load cards including pending learning cards
        setIsWaiting(false);
        setCountdown(null);
        loadDueCards(true); // includePending = true - show learning cards even if not due yet
    };

    // Format countdown display
    const formatCountdown = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    };

    // Get card state badge
    const getCardStateBadge = (card: Marker) => {
        const state = card.cardState || 'new';
        
        switch (state) {
            case 'new':
                return (
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <Zap size={12} /> New
                    </span>
                );
            case 'learning':
                return (
                    <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <RotateCcw size={12} /> Learning
                    </span>
                );
            case 'review':
                return (
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock size={12} /> Review
                    </span>
                );
            case 'relearning':
                return (
                    <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <RefreshCw size={12} /> Relearning
                    </span>
                );
            default:
                return null;
        }
    };

    // Module-specific styling
    const getModuleColor = () => {
        switch (module) {
            case 'listening': return 'yellow';
            case 'speaking': return 'green';
            case 'reading': return 'blue';
            case 'writing': return 'purple';
            default: return 'yellow';
        }
    };

    const moduleColor = getModuleColor();

    // Get preview intervals from the card itself (populated by API)
    const intervals = currentCard?.previewIntervals || null;

    // Loading state
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-950 p-8 text-center transition-colors">
                <div className={`w-16 h-16 border-4 border-${moduleColor}-500 border-t-transparent rounded-full animate-spin mb-4`} />
                <p className="text-gray-500 dark:text-gray-400">Loading flashcards...</p>
            </div>
        );
    }

    // Waiting for learning cards state
    if (isWaiting && learningStatus) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-950 p-8 text-center transition-colors">
                <div className={`w-24 h-24 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-6`}>
                    <Timer size={48} className="text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Waiting for Learning Cards</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md">
                    You have {learningStatus.pendingCount} card{learningStatus.pendingCount !== 1 ? 's' : ''} in the learning queue.
                </p>
                
                {countdown !== null && countdown > 0 && (
                    <div className="mb-8">
                        <div className="text-5xl font-mono font-bold text-orange-500 mb-2">
                            {formatCountdown(countdown)}
                        </div>
                        <p className="text-sm text-gray-400">until next card is due</p>
                    </div>
                )}
                
                <div className="flex gap-4">
                    <button
                        onClick={handleContinueNow}
                        className={`px-8 py-3 bg-${moduleColor}-500 text-black font-bold rounded-xl hover:bg-${moduleColor}-400 transition-colors`}
                    >
                        Check Now
                    </button>
                    <button
                        onClick={onExit}
                        className="px-8 py-3 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                        Exit Session
                    </button>
                </div>
                
                {/* Session stats so far */}
                {sessionStats.reviewed > 0 && (
                    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800 w-full max-w-md">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Session progress so far:</p>
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div>
                                <div className="text-lg font-bold text-gray-800 dark:text-white">{sessionStats.reviewed}</div>
                                <div className="text-[10px] text-gray-400 uppercase">Reviewed</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-red-500">{sessionStats.again}</div>
                                <div className="text-[10px] text-gray-400 uppercase">Again</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-orange-500">{sessionStats.hard}</div>
                                <div className="text-[10px] text-gray-400 uppercase">Hard</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-green-500">{sessionStats.good + sessionStats.easy}</div>
                                <div className="text-[10px] text-gray-400 uppercase">Good/Easy</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Session complete state
    if (isSessionComplete) {
        const accuracy = sessionStats.reviewed > 0 
            ? Math.round(((sessionStats.good + sessionStats.easy) / sessionStats.reviewed) * 100) 
            : 0;

        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-950 p-8 text-center transition-colors">
                <div className={`w-24 h-24 bg-${moduleColor}-100 dark:bg-${moduleColor}-900/20 rounded-full flex items-center justify-center mb-6`}>
                    <Trophy size={48} className={`text-${moduleColor}-500`} />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Session Complete!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">You've reviewed all due cards for today.</p>
                
                {/* Session Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 w-full max-w-xl">
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{sessionStats.reviewed}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reviewed</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                        <div className="text-2xl font-bold text-green-500">{accuracy}%</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Retention</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                        <div className="text-2xl font-bold text-red-500">{sessionStats.again}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Again</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                        <div className="text-2xl font-bold text-blue-500">{sessionStats.good + sessionStats.easy}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remembered</div>
                    </div>
                </div>

                <button
                    onClick={onExit}
                    className={`px-8 py-3 bg-${moduleColor}-500 text-black font-bold rounded-xl hover:bg-${moduleColor}-400 transition-colors`}
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    // Empty deck state
    if (!currentCard) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-950 p-8 text-center transition-colors">
                <div className={`w-24 h-24 bg-${moduleColor}-50 dark:bg-${moduleColor}-900/20 rounded-full flex items-center justify-center mb-6`}>
                    <Calendar size={48} className={`text-${moduleColor}-500`} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">All Caught Up!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-md">
                    No cards due for review right now. Come back later or add new vocabulary to study.
                </p>
                {stats && (
                    <div className="flex gap-4 mt-6 text-sm">
                        <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800">
                            <span className="text-gray-500 dark:text-gray-400">Total: </span>
                            <span className="font-bold text-gray-800 dark:text-white">{stats.total}</span>
                        </div>
                        <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800">
                            <span className="text-gray-500 dark:text-gray-400">Mastered: </span>
                            <span className="font-bold text-green-500">{stats.mastered}</span>
                        </div>
                    </div>
                )}
                <button
                    onClick={onExit}
                    className="mt-8 text-blue-500 hover:underline"
                >
                    Go back
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 font-sans transition-colors relative">
            {/* Top Bar: Progress & Stats (Hidden in Preview Mode) */}
            {!previewMode && (
                <div className="absolute top-0 left-0 right-0 p-6 z-10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <button onClick={onExit} className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-2 text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">
                            <ArrowLeft size={16} /> Exit Review
                        </button>
                        <div className="flex items-center gap-4">
                            {/* Settings button */}
                            <button 
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-gray-200 dark:bg-gray-800' : 'hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                            >
                                <Settings size={16} className="text-gray-500" />
                            </button>
                            {/* Stats badges */}
                            {stats && (
                                <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                                        New: {stats.new}
                                    </span>
                                    <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded">
                                        Learning: {stats.learning}
                                    </span>
                                    <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                                        Review: {stats.review}
                                    </span>
                                </div>
                            )}
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                {currentIndex + 1} / {dueCards.length}
                            </span>
                        </div>
                    </div>
                    
                    {/* Settings Panel */}
                    {showSettings && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-lg animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Sort Option */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                        Sort Order
                                    </label>
                                    <select
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white"
                                    >
                                        <option value="due_first">Due First (Recommended)</option>
                                        <option value="random">Random</option>
                                        <option value="newest">Newest First</option>
                                        <option value="oldest">Oldest First</option>
                                    </select>
                                </div>
                                
                                {/* New Cards Limit */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                        New Cards Limit
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="No limit"
                                        value={newCardsLimit ?? ''}
                                        onChange={(e) => setNewCardsLimit(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">
                                Changes take effect on next session reload.
                            </p>
                        </div>
                    )}
                    
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-${moduleColor}-400 rounded-full transition-all duration-300 ease-out`}
                            style={{ width: `${Math.max(5, progress)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Preview Mode Close Button */}
            {previewMode && (
                <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-end">
                    <button onClick={onExit} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors bg-white/50 dark:bg-black/20 p-2 rounded-full backdrop-blur-sm">
                        <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Close Preview</span>
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full p-1">
                            <ArrowLeft size={16} className="rotate-180" />
                        </div>
                    </button>
                </div>
            )}

            {/* Main Card Area */}
            <div className="flex-1 overflow-y-auto w-full relative custom-scrollbar">
                <div className="min-h-full flex flex-col items-center justify-center p-6 text-center pt-24">

                    {/* Card Status Indicator */}
                    {!previewMode && currentCard && (
                        <div className="mb-4 flex items-center gap-2">
                            {getCardStateBadge(currentCard)}
                        </div>
                    )}

                    {/* The Card */}
                    <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-xl dark:shadow-2xl border border-gray-100 dark:border-gray-800 p-12 min-h-[400px] flex flex-col items-center justify-center text-center transition-all duration-500 relative overflow-hidden">

                        {/* Audio Icon (Front Identity) */}
                        {module === 'reading' ? (
                            // Reading module front/back
                            <>
                                <div className="mb-8 relative group">
                                    <div className={`w-20 h-20 bg-${moduleColor}-50 dark:bg-${moduleColor}-500/10 rounded-full flex items-center justify-center transition-transform transform group-hover:scale-110`}>
                                        <Volume2 size={32} className={`text-${moduleColor}-500`} />
                                    </div>
                                </div>

                                {!isFlipped && currentCard && (
                                    <div className="animate-in fade-in zoom-in duration-300 max-w-2xl mx-auto mb-8">
                                        <div className="mb-6 flex flex-wrap justify-center gap-2">
                                            {getGroupedItems(currentCard).length > 0 ? (
                                                getGroupedItems(currentCard).map((item, idx) => (
                                                    <span
                                                        key={`${item.mainIndex}-${idx}`}
                                                        className={`px-3 py-1 rounded-full text-sm font-semibold border ${item.isPhrase
                                                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                                            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                                            }`}
                                                    >
                                                        {item.text}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">No marked words</span>
                                            )}
                                        </div>

                                        <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed text-center">
                                            {renderHighlightedSentence(currentCard)}
                                        </p>
                                    </div>
                                )}

                                {!isFlipped && (
                                    <>
                                        <button
                                            onClick={() => speakText(currentCard?.subtitleText || '')}
                                            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-xl"
                                        >
                                            <Volume2 size={18} /> Listen
                                        </button>
                                        <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-4 italic">
                                            (Uses text-to-speech)
                                        </p>
                                    </>
                                )}

                                {isFlipped && currentCard && (
                                    <div className="w-full mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-left animate-in slide-in-from-bottom-4 duration-500">
                                        <div className="mb-4 flex items-center gap-2">
                                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest capitalize">Reading Practice</span>
                                        </div>

                                        <div className="space-y-4">
                                            {(() => {
                                                const items = getGroupedItems(currentCard);
                                                if (items.length === 0) {
                                                    return <p className="text-sm text-gray-400 italic">No marked words.</p>;
                                                }
                                                return items.map((item, idx) => {
                                                    const data = currentCard.vocabData?.[item.mainIndex] || { definition: '', notes: '' };
                                                    const tagClass = item.isPhrase
                                                        ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300'
                                                        : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300';

                                                    return (
                                                        <div key={`${item.mainIndex}-${idx}`} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{item.text}</h3>
                                                                <span className={`${tagClass} text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider`}> 
                                                                    {item.isPhrase ? 'Phrase' : 'Word'}
                                                                </span>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div>
                                                                    <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Meaning</div>
                                                                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                                                        {data.definition || <span className="italic text-gray-400">No definition provided.</span>}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Sentence Translation</div>
                                                                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                                                        {data.notes || <span className="italic text-gray-400">No translation provided.</span>}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            // Original audio player for listening/speaking/writing modules
                            <>
                                <div className="mb-8 relative group cursor-pointer" onClick={handlePlayAudio}>
                                    <div className={`w-20 h-20 bg-${moduleColor}-50 dark:bg-${moduleColor}-500/10 rounded-full flex items-center justify-center transition-transform transform group-hover:scale-110`}>
                                        <Volume2 size={32} className={`text-${moduleColor}-500`} />
                                    </div>
                                    {/* Ripple Effect hint */}
                                    <div className={`absolute inset-0 border-2 border-${moduleColor}-500/30 rounded-full animate-ping opacity-0 group-hover:opacity-100`} />
                                </div>

                                {/* Instruction */}
                                {!isFlipped && (
                                    <div className="animate-in fade-in zoom-in duration-300">
                                        <p className="text-gray-400 dark:text-gray-500 font-medium text-lg mb-8">Listen to the phrase...</p>
                                    </div>
                                )}

                                {/* Play Button */}
                                <button
                                    onClick={handlePlayAudio}
                                    className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-xl"
                                >
                                    <Play size={18} fill="currentColor" /> Play Audio
                                </button>
                                <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-4 italic">
                                    (Audio plays from main video)
                                </p>
                            </>
                        )}


                        {/* Separator / Reveal Area */}
                        {isFlipped && module !== 'reading' && (
                            <div className="w-full mt-10 pt-10 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-4 duration-500 text-left">
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest capitalize">{module} Practice</span>
                                </div>

                                {/* 1. Full Sentence with Highlights */}
                                <div className="mb-8">
                                    <h2 className="text-2xl font-medium text-gray-800 dark:text-gray-100 leading-relaxed text-center">
                                        {(() => {
                                            const words = currentCard.subtitleText?.trim().split(/\s+/).filter(w => w.length > 0) || [];
                                            return words.map((word, i) => {
                                                const markedIndices = currentCard.misunderstoodIndices || [];
                                                const isMarked = markedIndices.includes(i);
                                                // Simple grouping logic for visual continuity if adjacent
                                                const isPhrasePart = isMarked && (markedIndices.includes(i - 1) || markedIndices.includes(i + 1));

                                                if (isMarked) {
                                                    const colorClass = isPhrasePart
                                                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                                        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';

                                                    const dotClass = isPhrasePart ? 'bg-green-500' : 'bg-red-500';

                                                    return (
                                                        <span key={i} className={`
                                                        inline-block mx-1 px-1.5 rounded relative border ${colorClass}
                                                    `}>
                                                            {word}
                                                            <span className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full translate-x-1/2 -translate-y-1/2 border border-white dark:border-gray-900 ${dotClass}`}></span>
                                                        </span>
                                                    );
                                                }
                                                return <span key={i} className="mx-1">{word}</span>;
                                            });
                                        })()}
                                    </h2>
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-800 my-6"></div>

                                {/* 2. Marked Expressions List */}
                                <div className="space-y-6">
                                    <span className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Marked Expressions</span>

                                    {(() => {
                                        const words = currentCard.subtitleText?.trim().split(/\s+/).filter(w => w.length > 0) || [];
                                        const markedIndices = currentCard.misunderstoodIndices || [];

                                        // Group consecutive indices
                                        const groupedItems: { indices: number[], text: string, mainIndex: number }[] = [];
                                        if (markedIndices.length > 0) {
                                            const sortedIndices = [...markedIndices].sort((a, b) => a - b);
                                            let currentGroup: number[] = [sortedIndices[0]];

                                            for (let i = 1; i < sortedIndices.length; i++) {
                                                if (sortedIndices[i] === sortedIndices[i - 1] + 1) {
                                                    currentGroup.push(sortedIndices[i]);
                                                } else {
                                                    groupedItems.push({
                                                        indices: currentGroup,
                                                        text: currentGroup.map(idx => words[idx] || '').join(' '),
                                                        mainIndex: currentGroup[0]
                                                    });
                                                    currentGroup = [sortedIndices[i]];
                                                }
                                            }
                                            groupedItems.push({
                                                indices: currentGroup,
                                                text: currentGroup.map(idx => words[idx] || '').join(' '),
                                                mainIndex: currentGroup[0]
                                            });
                                        }

                                        return groupedItems.map((item, idx) => {
                                            const data = currentCard.vocabData?.[item.mainIndex] || { definition: '', notes: '' };
                                            const isPhrase = item.indices.length > 1;

                                            const dotColor = isPhrase ? 'bg-green-500' : 'bg-red-500';
                                            const tagClass = isPhrase
                                                ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300'
                                                : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300';

                                            return (
                                                <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className={`h-2 w-2 rounded-full ${dotColor}`}></div>
                                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{item.text}</h3>
                                                        <span className={`${tagClass} text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider`}>
                                                            {isPhrase ? 'Phrase' : 'Word'}
                                                        </span>
                                                    </div>

                                                    <div className="pl-5 border-l-2 border-gray-200 dark:border-gray-700 ml-1">
                                                        <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Meaning</div>
                                                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                                            {data.definition || <span className="italic text-gray-400">No definition provided.</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="p-8 pb-12 w-full max-w-4xl mx-auto">
                {!isFlipped ? (
                    <button
                        onClick={() => setIsFlipped(true)}
                        className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-bold text-lg py-4 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-[0.99]"
                    >
                        Show Answer
                    </button>
                ) : (
                    <div className="grid grid-cols-4 gap-4 animate-in slide-in-from-bottom-2 duration-300">
                        {/* SRS Buttons with Dynamic Intervals */}
                        <button 
                            onClick={() => handleReview('again')} 
                            disabled={isSubmitting}
                            className="flex flex-col items-center gap-1 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-200 dark:hover:border-red-900/30 transition-all group disabled:opacity-50"
                        >
                            <span className="text-sm font-bold text-red-500 group-hover:text-red-600">Again</span>
                            <span className="text-[10px] text-gray-400 group-hover:text-red-400/70">
                                {intervals?.again?.display || '1m'}
                            </span>
                        </button>

                        <button 
                            onClick={() => handleReview('hard')} 
                            disabled={isSubmitting}
                            className="flex flex-col items-center gap-1 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/10 hover:border-orange-200 dark:hover:border-orange-900/30 transition-all group disabled:opacity-50"
                        >
                            <span className="text-sm font-bold text-orange-500 group-hover:text-orange-600">Hard</span>
                            <span className="text-[10px] text-gray-400 group-hover:text-orange-400/70">
                                {intervals?.hard?.display || '1m'}
                            </span>
                        </button>

                        <button 
                            onClick={() => handleReview('good')} 
                            disabled={isSubmitting}
                            className={`flex flex-col items-center gap-1 py-3 bg-${moduleColor}-400 border border-${moduleColor}-500 rounded-xl shadow-lg shadow-${moduleColor}-500/20 hover:bg-${moduleColor}-300 transition-all transform hover:-translate-y-1 disabled:opacity-50`}
                        >
                            <span className="text-sm font-bold text-black">Good</span>
                            <span className={`text-[10px] text-${moduleColor}-800 font-medium`}>
                                {intervals?.good?.display || '10m'}
                            </span>
                        </button>

                        <button 
                            onClick={() => handleReview('easy')} 
                            disabled={isSubmitting}
                            className="flex flex-col items-center gap-1 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-green-200 dark:hover:border-green-900/30 transition-all group disabled:opacity-50"
                        >
                            <span className="text-sm font-bold text-green-500 group-hover:text-green-600">Easy</span>
                            <span className="text-[10px] text-gray-400 group-hover:text-green-400/70">
                                {intervals?.easy?.display || '4d'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlashcardPractice;

// Tailwind Safelist for dynamic classes
// text-yellow-500 text-blue-500 text-green-500 text-purple-500
// text-yellow-800 text-blue-800 text-green-800 text-purple-800
// bg-yellow-50 bg-blue-50 bg-green-50 bg-purple-50
// bg-yellow-100 bg-blue-100 bg-green-100 bg-purple-100
// bg-yellow-300 bg-blue-300 bg-green-300 bg-purple-300
// bg-yellow-400 bg-blue-400 bg-green-400 bg-purple-400
// bg-yellow-500/10 bg-blue-500/10 bg-green-500/10 bg-purple-500/10
// bg-yellow-900/20 bg-blue-900/20 bg-green-900/20 bg-purple-900/20
// border-yellow-500 border-blue-500 border-green-500 border-purple-500
// shadow-yellow-500/20 shadow-blue-500/20 shadow-green-500/20 shadow-purple-500/20
// hover:bg-yellow-300 hover:bg-blue-300 hover:bg-green-300 hover:bg-purple-300
// dark:bg-yellow-500/10 dark:bg-blue-500/10 dark:bg-green-500/10 dark:bg-purple-500/10
// dark:text-yellow-500 dark:text-blue-500 dark:text-green-500 dark:text-purple-500
// dark:border-yellow-500/30 dark:border-blue-500/30 dark:border-green-500/30 dark:border-purple-500/30
