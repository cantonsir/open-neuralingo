import React, { useState, useEffect } from 'react';
import { Plus, Play, Trash2, Clock, BookOpen, Loader2, Globe } from 'lucide-react';
import { api, GoalVideo } from '../../db';

interface LearningHomeProps {
    onSelectGoal: (goalId: string) => void;
    defaultLanguage?: string;
    cachedGoals?: GoalVideo[];
    isLoaded?: boolean;
    onGoalsUpdate?: (goals: GoalVideo[]) => void;
}

// Common languages with emoji flags
const LANGUAGE_FLAGS: Record<string, string> = {
    'en': '🇺🇸',
    'es': '🇪🇸',
    'fr': '🇫🇷',
    'de': '🇩🇪',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'zh': '🇨🇳',
    'pt': '🇧🇷',
    'ru': '🇷🇺',
    'it': '🇮🇹',
    'ar': '🇸🇦',
};

const LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'it': 'Italian',
    'ar': 'Arabic',
};

const LearningHome: React.FC<LearningHomeProps> = ({ 
    onSelectGoal, 
    defaultLanguage = 'en',
    cachedGoals = [],
    isLoaded = false,
    onGoalsUpdate
}) => {
    const [goals, setGoals] = useState<GoalVideo[]>(cachedGoals);
    const [isLoading, setIsLoading] = useState(!isLoaded);
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync with cached data from parent
    useEffect(() => {
        if (isLoaded) {
            setGoals(cachedGoals);
            setIsLoading(false);
        }
    }, [cachedGoals, isLoaded]);

    const loadGoals = async () => {
        setIsLoading(true);
        const fetchedGoals = await api.fetchGoals();
        setGoals(fetchedGoals);
        onGoalsUpdate?.(fetchedGoals); // Update parent cache
        setIsLoading(false);
    };

    const extractVideoId = (url: string): string | null => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const handleAddGoal = async () => {
        const videoId = extractVideoId(newVideoUrl);
        if (!videoId) {
            setError('Invalid YouTube URL');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            // Fetch video title from oEmbed
            let title = `YouTube Video (${videoId})`;
            try {
                const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
                if (res.ok) {
                    const data = await res.json();
                    title = data.title;
                }
            } catch { /* ignore */ }

            // Use the language from Settings automatically
            const result = await api.createGoal(videoId, defaultLanguage, title);

            if (result.status === 'exists') {
                setError('This video is already in your learning goals');
            } else {
                resetModal();
                loadGoals();
            }
        } catch (err) {
            console.error('Failed to add goal:', err);
            setError('Failed to add goal. Make sure the video has subtitles in your language.');
        } finally {
            setIsCreating(false);
        }
    };

    const resetModal = () => {
        setIsAddingGoal(false);
        setNewVideoUrl('');
        setError(null);
    };

    const handleDeleteGoal = async (goalId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this learning goal? Your progress will be lost.')) {
            await api.deleteGoal(goalId);
            loadGoals();
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatProgress = (progress: number): string => {
        return `${Math.round(progress * 100)}%`;
    };

    const getLanguageFlag = (code: string): string => {
        return LANGUAGE_FLAGS[code?.split('-')[0]] || '🌐';
    };

    const getLanguageName = (code: string): string => {
        return LANGUAGE_NAMES[code?.split('-')[0]] || code?.toUpperCase() || 'Unknown';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-950">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-950 p-8">
            {/* Header */}
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            My Learning Goals
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            Set a video as your goal and master it through listening
                        </p>
                    </div>
                    <button
                        onClick={() => setIsAddingGoal(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg shadow-yellow-500/25"
                    >
                        <Plus className="w-5 h-5" />
                        Add Goal Video
                    </button>
                </div>

                {/* Add Goal Modal - Simple single step */}
                {isAddingGoal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Add Learning Goal
                            </h2>

                            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                                Paste a YouTube URL. We'll fetch {getLanguageFlag(defaultLanguage)} {getLanguageName(defaultLanguage)} subtitles.
                            </p>

                            <input
                                type="text"
                                value={newVideoUrl}
                                onChange={(e) => setNewVideoUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-4"
                                autoFocus
                            />

                            {/* Show current language from Settings */}
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                <Globe className="w-4 h-4" />
                                <span>Learning: {getLanguageFlag(defaultLanguage)} {getLanguageName(defaultLanguage)}</span>
                                <span className="text-gray-400 text-xs">(change in Settings)</span>
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm mb-4">{error}</p>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={resetModal}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddGoal}
                                    disabled={isCreating || !newVideoUrl}
                                    className="flex items-center gap-2 px-5 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50"
                                >
                                    {isCreating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Goal'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Goals List */}
                {goals.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            No learning goals yet
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            Add a YouTube video you want to understand through listening
                        </p>
                        <button
                            onClick={() => setIsAddingGoal(true)}
                            className="inline-flex items-center gap-2 px-5 py-3 bg-yellow-500 text-black font-semibold rounded-xl hover:bg-yellow-400"
                        >
                            <Plus className="w-5 h-5" />
                            Add Your First Goal
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {goals.map(goal => (
                            <div
                                key={goal.id}
                                onClick={() => onSelectGoal(goal.id)}
                                className="group flex gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/10 transition-all cursor-pointer"
                            >
                                {/* Thumbnail */}
                                <div className="relative w-48 h-28 rounded-lg overflow-hidden flex-shrink-0">
                                    <img
                                        src={goal.thumbnail}
                                        alt={goal.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Play className="w-10 h-10 text-white" fill="currentColor" />
                                    </div>
                                    {/* Language Badge */}
                                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded-md">
                                        {getLanguageFlag(goal.language)} {goal.language?.toUpperCase() || 'EN'}
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate group-hover:text-yellow-500 transition-colors">
                                        {goal.title}
                                    </h3>

                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {formatDuration(goal.durationSeconds)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <BookOpen className="w-4 h-4" />
                                            {goal.totalSegments} lessons
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-2">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Progress</span>
                                            <span className="text-yellow-500 font-medium">
                                                {formatProgress(goal.overallProgress)}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                                                style={{ width: `${goal.overallProgress * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {goal.lastStudiedAt && (
                                        <p className="text-xs text-gray-400">
                                            Last studied: {new Date(goal.lastStudiedAt).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-start gap-2">
                                    <button
                                        onClick={(e) => handleDeleteGoal(goal.id, e)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Delete goal"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LearningHome;
