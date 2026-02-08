import React, { useState, useEffect } from 'react';
import { Play, Clock, BookOpen, Layers, TrendingUp, Trash2, X, Check } from 'lucide-react';
import { api, HistoryItem } from '../../db';
import { formatTimeAgo } from '../../utils/formatters';

interface HistoryViewProps {
    onPlayVideo: (videoId: string) => void;
    savedCardsCount: number;
    markersCount: number;
}

export default function HistoryView({ onPlayVideo, savedCardsCount, markersCount }: HistoryViewProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // Load history on mount
    useEffect(() => {
        const loadHistory = async () => {
            setLoading(true);
            const data = await api.fetchHistory();
            setHistory(data);
            setLoading(false);
        };
        loadHistory();
    }, []);

    const handleDelete = async (videoId: string) => {
        try {
            await api.deleteFromHistory(videoId);
            setHistory(prev => prev.filter(h => h.videoId !== videoId));
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const handleDeleteSelected = async () => {
        try {
            for (const id of selectedIds) {
                await api.deleteFromHistory(id);
            }
            setHistory(prev => prev.filter(h => !selectedIds.has(h.videoId)));
            setSelectedIds(new Set());
            setSelectMode(false);
        } catch (error) {
            console.error('Failed to delete selected:', error);
        }
    };

    const handleClearAll = async () => {
        if (confirm('Are you sure you want to clear all watch history?')) {
            try {
                await api.clearHistory();
                setHistory([]);
                setSelectMode(false);
                setSelectedIds(new Set());
            } catch (error) {
                console.error('Failed to clear history:', error);
            }
        }
    };

    const toggleSelect = (videoId: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(videoId)) {
            newSelected.delete(videoId);
        } else {
            newSelected.add(videoId);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === history.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(history.map(h => h.videoId)));
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-gray-500">Loading history...</div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                            <TrendingUp size={20} className="text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{markersCount}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Today's Markers</div>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{savedCardsCount}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Words Saved</div>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Layers size={20} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{history.length}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Videos Practiced</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Clock size={20} className="text-gray-400" />
                    Watch History
                </h2>
                <div className="flex items-center gap-2">
                    {selectMode ? (
                        <>
                            <button
                                onClick={toggleSelectAll}
                                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                {selectedIds.size === history.length ? 'Deselect all' : 'Select all'}
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.size === 0}
                                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                                <Trash2 size={14} />
                                Delete ({selectedIds.size})
                            </button>
                            <button
                                onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            {history.length > 0 && (
                                <button
                                    onClick={() => setSelectMode(true)}
                                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                >
                                    Select
                                </button>
                            )}
                            <button
                                onClick={handleClearAll}
                                disabled={history.length === 0}
                                className="text-sm text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Clear all
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* History Grid */}
            {history.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {history.map((item) => (
                        <div
                            key={item.videoId}
                            onClick={() => selectMode ? toggleSelect(item.videoId) : onPlayVideo(item.videoId)}
                            className={`
                group cursor-pointer bg-white dark:bg-gray-900 rounded-xl overflow-hidden border transition-all duration-200
                ${selectMode && selectedIds.has(item.videoId)
                                    ? 'border-red-500 ring-2 ring-red-500/30'
                                    : 'border-gray-100 dark:border-gray-800 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/10'
                                }
              `}
                        >
                            {/* Thumbnail */}
                            <div className="relative aspect-video bg-gray-200 dark:bg-gray-800">
                                <img
                                    src={item.thumbnail}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect fill="%23374151" width="320" height="180"/><text fill="%239CA3AF" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14">No Thumbnail</text></svg>';
                                    }}
                                />
                                {/* Duration badge */}
                                {item.duration && (
                                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
                                        {item.duration}
                                    </span>
                                )}

                                {/* Select mode checkbox */}
                                {selectMode && (
                                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds.has(item.videoId)
                                            ? 'bg-red-500 border-red-500'
                                            : 'bg-white/80 border-gray-300'
                                        }`}>
                                        {selectedIds.has(item.videoId) && <Check size={14} className="text-white" />}
                                    </div>
                                )}

                                {/* Play overlay */}
                                {!selectMode && (
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                            <Play size={20} fill="white" className="text-white ml-1" />
                                        </div>
                                    </div>
                                )}

                                {/* Delete button */}
                                {!selectMode && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(item.videoId); }}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X size={14} className="text-white" />
                                    </button>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-3">
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 mb-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                                    {item.title}
                                </h3>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>{formatTimeAgo(item.watchedAt)}</span>
                                    {item.wordsLearned !== undefined && item.wordsLearned > 0 && (
                                        <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                            <BookOpen size={12} />
                                            {item.wordsLearned} words
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">📺</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No watch history yet</h3>
                    <p className="text-gray-500 dark:text-gray-400">Start practicing with a YouTube video to see your history here</p>
                </div>
            )}
        </div>
    );
}
