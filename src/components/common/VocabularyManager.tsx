import React, { useMemo, useState, useEffect } from 'react';
import { Marker, SrsStats, SortOption as FlashcardSortOption } from '../../types';
import { FlashcardModule, api } from '../../db';
import { BookOpen, Activity, Play, Save, Flag, Volume2, Sparkles, CheckCircle2, Circle, Eye, Search, Filter, Download, BarChart3, Calendar, TrendingUp, Clock, X, ChevronDown } from 'lucide-react';
import { formatTime } from '../../utils';
import { generateDefinition } from '../../ai';
import Toast from './Toast';
import Modal from './Modal';
import FlashcardPractice from './FlashcardPractice';

interface VocabularyManagerProps {
    module: FlashcardModule;
    markers: Marker[];
    savedCards?: Marker[]; // New prop for DB cards
    onRemoveWord: (word: string) => void;
    onUpdateVocabData: (markerId: string, index: number, field: 'definition' | 'notes', value: string) => void;
    onPlaySegment: (start: number, end: number, videoId?: string) => void;
    onSaveToDeck: (marker: Marker) => void;
    onDeleteCard?: (id: string) => void; // New prop for DB delete
    onUpdateCard?: (id: string, updates: Partial<Marker>) => void; // New prop for DB update
    onDiscardSessionMarker?: (id: string) => void; // Prop for session discard
    onProcessQueue?: () => void;
}

type VocabSortOption = 'newest' | 'oldest' | 'most-practiced' | 'due-first';
type FilterSource = 'all' | 'loop' | 'shadow';

const cleanToken = (token: string) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

const getFlashcardSortKey = (module: string) => `flashcard-sort-${module}`;
const getFlashcardNewLimitKey = (module: string) => `flashcard-new-limit-${module}`;

const getFlashcardSortOption = (module: FlashcardModule): FlashcardSortOption => {
    const raw = localStorage.getItem(getFlashcardSortKey(module));
    if (raw === 'due_first' || raw === 'random' || raw === 'newest' || raw === 'oldest') {
        return raw;
    }
    return 'due_first';
};

const getFlashcardNewLimit = (module: FlashcardModule): number | undefined => {
    const raw = localStorage.getItem(getFlashcardNewLimitKey(module));
    if (!raw) return undefined;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const VocabularyManager: React.FC<VocabularyManagerProps> = ({
    module,
    markers,
    savedCards = [],
    onRemoveWord,
    onUpdateVocabData,
    onPlaySegment,
    onSaveToDeck,
    onDeleteCard,
    onUpdateCard,
    onDiscardSessionMarker,
    onProcessQueue
}) => {
    const [viewMode, setViewMode] = useState<'session' | 'collection'>('session');
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<VocabSortOption>('newest');
    const [filterSource, setFilterSource] = useState<FilterSource>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [showStats, setShowStats] = useState(true);
    const [queueOnly, setQueueOnly] = useState(false);

    // Stats State
    const [srsStats, setSrsStats] = useState<SrsStats | null>(null);
    const [queueIds, setQueueIds] = useState<string[]>([]);
    const [isQueueLoading, setIsQueueLoading] = useState(false);

    // Bulk Items State
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

    // UI State
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', actionLabel?: string, onAction?: () => void } | null>(null);
    const [showDiscardModal, setShowDiscardModal] = useState(false);

    // Load SRS stats when in collection mode
    useEffect(() => {
        if (viewMode === 'collection') {
            api.fetchSrsStats(module).then(setSrsStats);
        }
    }, [viewMode, module, savedCards]);

    // Load current flashcard queue order when in collection mode
    useEffect(() => {
        let cancelled = false;

        const loadQueue = async () => {
            if (viewMode !== 'collection') {
                setQueueIds([]);
                return;
            }

            setIsQueueLoading(true);
            try {
                const sortOption = getFlashcardSortOption(module);
                const newLimit = getFlashcardNewLimit(module);
                const dueCards = await api.fetchDueCards(module, true, sortOption, newLimit, false);
                const queue = dueCards
                    .filter(card => card.misunderstoodIndices && card.misunderstoodIndices.length > 0)
                    .map(card => card.id);

                if (!cancelled) {
                    setQueueIds(queue);
                }
            } catch (error) {
                if (!cancelled) {
                    setQueueIds([]);
                }
            } finally {
                if (!cancelled) {
                    setIsQueueLoading(false);
                }
            }
        };

        loadQueue();

        return () => {
            cancelled = true;
        };
    }, [viewMode, module, savedCards]);

    const queuePositionById = useMemo(() => {
        const map = new Map<string, number>();
        queueIds.forEach((id, index) => {
            map.set(id, index + 1);
        });
        return map;
    }, [queueIds]);

    // Module specific colors
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


    // HELPER: Toggle Check
    const toggleCheck = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(checkedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setCheckedIds(newSet);
    };

    // HELPER: Select All
    const handleSelectAll = () => {
        if (checkedIds.size === filteredMarkers.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(filteredMarkers.map(m => m.id)));
        }
    };

    // HELPER: Bulk Discard / Delete
    const handleBulkDiscard = () => {
        if (viewMode === 'session') {
            // Session Mode: Discard from markers list
            if (onDiscardSessionMarker) {
                checkedIds.forEach(id => onDiscardSessionMarker(id));
            }
        } else {
            // Collection Mode: Delete !
            if (onDeleteCard) {
                checkedIds.forEach(id => onDeleteCard(id));
            }
        }

        // Single Item Discard Fallback
        if (selectedMarker && checkedIds.size === 0) {
            if (viewMode === 'session') {
                onDiscardSessionMarker?.(selectedMarker.id);
            } else {
                onDeleteCard?.(selectedMarker.id);
            }
        }

        setCheckedIds(new Set());
        setShowDiscardModal(false);
        setToast({ message: `Items Removed`, type: 'success', actionLabel: 'Undo', onAction: () => { } });
    };

    // HELPER: Bulk Save
    const handleBulkSave = () => {
        const markersToSave = filteredMarkers.filter(m => checkedIds.has(m.id));
        markersToSave.forEach(m => onSaveToDeck(m));
        setToast({ message: `${markersToSave.length} cards saved to collection`, type: 'success', actionLabel: 'Undo', onAction: () => { } });
        setCheckedIds(new Set()); // Clear selection after save
    };

    // HELPER: Export cards
    const handleExport = async () => {
        try {
            const data = await api.exportCards(module, 'json');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${module}-vocabulary-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setToast({ message: 'Vocabulary exported successfully', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to export vocabulary', type: 'error' });
        }
    };

    // 1. Get List based on View Mode with Search and Filtering
    const activeMarkers = useMemo(() => {
        const source = viewMode === 'session' ? markers : savedCards;
        return source.filter(m => m.misunderstoodIndices && m.misunderstoodIndices.length > 0);
    }, [markers, savedCards, viewMode]);

    // 2. Apply search, filter, and sort
    const filteredMarkers = useMemo(() => {
        let result = [...activeMarkers];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m => {
                const text = m.subtitleText?.toLowerCase() || '';
                const vocabText = Object.values(m.vocabData || {})
                    .map(v => v.definition?.toLowerCase() || '')
                    .join(' ');
                return text.includes(query) || vocabText.includes(query);
            });
        }

        // Source filter
        if (filterSource !== 'all') {
            result = result.filter(m => m.source === filterSource);
        }

        if (viewMode === 'collection' && queueOnly) {
            result = result.filter(m => queuePositionById.has(m.id));
        }

        if (viewMode === 'collection' && queueOnly) {
            result.sort((a, b) => {
                const posA = queuePositionById.get(a.id) || Number.MAX_SAFE_INTEGER;
                const posB = queuePositionById.get(b.id) || Number.MAX_SAFE_INTEGER;
                return posA - posB;
            });
            return result;
        }

        // Sort
        switch (sortBy) {
            case 'oldest':
                result.sort((a, b) => a.createdAt - b.createdAt);
                break;
            case 'most-practiced':
                result.sort((a, b) => (b.pressCount || 0) - (a.pressCount || 0));
                break;
            case 'due-first':
                result.sort((a, b) => {
                    const dateA = a.nextReviewDate || '9999';
                    const dateB = b.nextReviewDate || '9999';
                    return dateA.localeCompare(dateB);
                });
                break;
            case 'newest':
            default:
                result.sort((a, b) => b.createdAt - a.createdAt);
                break;
        }

        return result;
    }, [activeMarkers, searchQuery, filterSource, sortBy, viewMode, queueOnly, queuePositionById]);

    // Derived state for the currently selected marker object
    const selectedMarker = filteredMarkers.find(m => m.id === selectedMarkerId) || (filteredMarkers.length > 0 ? filteredMarkers[0] : undefined);

    // Effect to sync ID if we defaulted
    useEffect(() => {
        if (!selectedMarker) return;
        const selectedStillVisible = selectedMarkerId ? filteredMarkers.some(m => m.id === selectedMarkerId) : false;
        if (!selectedMarkerId || !selectedStillVisible) {
            setSelectedMarkerId(selectedMarker.id);
        }
    }, [selectedMarkerId, selectedMarker, filteredMarkers]);


    const renderSidebarItem = (marker: Marker) => {
        const isSelected = selectedMarkerId === marker.id;
        const words = marker.subtitleText?.trim().split(/\s+/).filter(w => w.length > 0) || [];
        const subtitleSnippet = marker.subtitleText ? (marker.subtitleText.length > 40 ? marker.subtitleText.substr(0, 40) + '...' : marker.subtitleText) : "No text";

        const misunderstoodIndices = marker.misunderstoodIndices || [];

        // Group consecutive indices into conceptual items
        const groups: number[][] = [];
        if (misunderstoodIndices.length > 0) {
            const sorted = [...misunderstoodIndices].sort((a, b) => a - b);
            let current: number[] = [sorted[0]];
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] === sorted[i - 1] + 1) {
                    current.push(sorted[i]);
                } else {
                    groups.push(current);
                    current = [sorted[i]];
                }
            }
            groups.push(current);
        }

        const conceptualCount = groups.length;
        const hasPhrase = groups.some(g => g.length > 1);
        const pressCount = marker.pressCount || 1;
        const queuePosition = queuePositionById.get(marker.id);

        const primaryGroup = groups.length > 0 ? groups[0] : [];
        const markedText = primaryGroup.length > 0
            ? primaryGroup.map(idx => cleanToken(words[idx] || '')).filter(Boolean).join(' ')
            : '';

        // SRS status indicator
        const isNew = !marker.lastReviewedAt;
        const isLearning = marker.lastReviewedAt && (marker.interval || 0) < 7;
        const isMature = (marker.interval || 0) >= 21;

        let statusColor = 'bg-gray-300 dark:bg-gray-600';
        if (isNew) statusColor = 'bg-blue-500';
        else if (isLearning) statusColor = 'bg-orange-500';
        else if (isMature) statusColor = 'bg-green-500';

        const badgeColorClass = hasPhrase
            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 border-green-200 dark:border-green-900/50"
            : `bg-${moduleColor}-100 dark:bg-${moduleColor}-900/30 text-${moduleColor}-600 dark:text-${moduleColor}-300 border-${moduleColor}-200 dark:border-${moduleColor}-900/50`;

        return (
            <div
                key={marker.id}
                onClick={() => setSelectedMarkerId(marker.id)}
                className={`p-3 cursor-pointer border-l-4 transition-all group relative ${isSelected
                    ? `bg-${moduleColor}-50 dark:bg-${moduleColor}-900/10 border-${moduleColor}-500`
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
            >
                {/* Hover Checkbox */}
                <div
                    className={`absolute left-2 top-3 z-20 transition-opacity duration-200 ${checkedIds.has(marker.id) || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={(e) => toggleCheck(marker.id, e)}
                >
                    {checkedIds.has(marker.id) ? (
                        <CheckCircle2 size={14} className="text-blue-500 fill-blue-50 dark:fill-blue-900" />
                    ) : (
                        <Circle size={14} className="text-gray-300 hover:text-gray-400" />
                    )}
                </div>

                <div className={`flex justify-between items-start mb-1 pl-5`}>
                    <div className="flex items-center gap-2">
                        {viewMode === 'collection' && (
                            <div className={`w-2 h-2 rounded-full ${statusColor}`} title={isNew ? 'New' : isLearning ? 'Learning' : isMature ? 'Mastered' : 'Review'} />
                        )}
                        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">#{marker.id.substr(0, 4)}</span>
                    </div>
                    <div className="flex gap-1" title={`${pressCount} attempts`}>
                        {[...Array(Math.min(3, pressCount))].map((_, i) => (
                            <div key={i} className={`w-1 h-1 rounded-full bg-current text-gray-400`} />
                        ))}
                    </div>
                </div>
                <p className={`text-sm leading-snug pl-5 ${isSelected ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                    {markedText || subtitleSnippet}
                </p>
                <div className="mt-2 flex items-center gap-2 pl-5 flex-wrap">
                    {conceptualCount > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColorClass}`}>
                            {conceptualCount} Marked
                        </span>
                    )}
                    {viewMode === 'collection' && queuePosition && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 font-semibold">
                            Q{queuePosition}
                        </span>
                    )}
                    {marker.source && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            {marker.source}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const handleGenerateAI = async (markerId: string, index: number, text: string) => {
        setIsGenerating(true);
        const def = await generateDefinition(text);
        setIsGenerating(false);
        if (def) {
            if (viewMode === 'session') {
                onUpdateVocabData(markerId, index, 'definition', def);
            } else {
                // Database update
                const marker = filteredMarkers.find(m => m.id === markerId);
                if (marker) {
                    const currentVocab = marker.vocabData || {};
                    const currentItem = currentVocab[index] || { definition: '', notes: '' };
                    const newVocab = {
                        ...currentVocab,
                        [index]: { ...currentItem, definition: def }
                    };
                    onUpdateCard?.(markerId, { vocabData: newVocab });
                }
            }
        } else {
            alert("Could not generate definition. Check API Key.");
        }
    };

    const renderStatsPanel = () => {
        if (!srsStats || viewMode !== 'collection') return null;

        return (
            <div className={`bg-gradient-to-r from-${moduleColor}-50 to-${moduleColor}-100/50 dark:from-${moduleColor}-900/20 dark:to-${moduleColor}-900/10 border-b border-${moduleColor}-200 dark:border-${moduleColor}-900/30 p-4 transition-all ${showStats ? '' : 'hidden'}`}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <BarChart3 size={14} /> Collection Overview
                    </h3>
                    <button onClick={() => setShowStats(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={14} />
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-gray-800 dark:text-white">{srsStats.total}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Total</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-blue-500">{srsStats.new}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">New</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-orange-500">{srsStats.learning}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Learning</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-green-500">{srsStats.mastered}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Mastered</div>
                    </div>
                </div>
                {srsStats.dueToday > 0 && (
                    <div className={`mt-3 flex items-center justify-center gap-2 bg-${moduleColor}-500/20 text-${moduleColor}-700 dark:text-${moduleColor}-300 px-3 py-2 rounded-lg text-sm font-medium`}>
                        <Calendar size={14} />
                        {srsStats.dueToday} cards due for review today
                    </div>
                )}
            </div>
        );
    };

    const renderWorkbench = () => {
        if (!selectedMarker && checkedIds.size <= 1) return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Select a phrase to edit</p>
                </div>
            </div>
        );

        const isBulkMode = checkedIds.size > 1;

        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors relative">
                {/* Header (Hidden in Bulk Mode) */}
                {!isBulkMode && selectedMarker && (
                    <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 shrink-0 transition-colors">
                        <div className="flex items-center gap-3">
                            <BookOpen className={`text-${moduleColor}-500`} size={20} />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Vocabulary Editor</h2>
                            {selectedMarker.nextReviewDate && viewMode === 'collection' && (
                                <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded text-xs">
                                    <Clock size={10} /> Next: {selectedMarker.nextReviewDate}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsPreviewing(true)}
                                className="flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 rounded text-sm transition-colors border border-gray-300 dark:border-gray-700 shadow-sm"
                            >
                                <Eye size={14} /> Preview Flashcard
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                {isBulkMode ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
                        <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 size={48} className="text-blue-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            {checkedIds.size} Cards Selected
                        </h2>
                        <p className="text-gray-400 dark:text-gray-500 max-w-md">
                            You can save these directly to your collection or discard them in bulk.
                        </p>
                    </div>
                ) : (
                    selectedMarker && (
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {/* Sentence Display */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 mb-8 shadow-sm transition-colors">
                                <div className="flex flex-wrap gap-2 text-2xl leading-relaxed text-gray-800 dark:text-gray-300 font-medium justify-center text-center">
                                    {selectedMarker.subtitleText?.trim().split(/\s+/).filter(w => w.length > 0).map((word, i) => {
                                        const markedIndices = selectedMarker.misunderstoodIndices || [];
                                        const isMarked = markedIndices.includes(i);
                                        const isPhrasePart = isMarked && (markedIndices.includes(i - 1) || markedIndices.includes(i + 1));

                                        return (
                                            <span
                                                key={i}
                                                className={`
                                                px-2 py-0.5 rounded transition-all cursor-default relative group
                                                ${isMarked
                                                        ? (isPhrasePart
                                                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-100 border border-green-200 dark:border-green-500/30'
                                                            : `bg-${moduleColor}-100 dark:bg-${moduleColor}-500/20 text-${moduleColor}-700 dark:text-${moduleColor}-100 border border-${moduleColor}-200 dark:border-${moduleColor}-500/30`)
                                                        : 'hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                                                    }
                                            `}
                                            >
                                                {word}
                                                {isMarked && (
                                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPhrasePart ? 'bg-green-400' : `bg-${moduleColor}-400`}`}></span>
                                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isPhrasePart ? 'bg-green-500' : `bg-${moduleColor}-500`}`}></span>
                                                    </span>
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>
                                <div className="mt-6 text-center">
                                    <p className="text-xs text-gray-500 dark:text-gray-600 font-mono flex justify-center items-center gap-2">
                                        <Activity size={12} />
                                        ATTEMPTED {selectedMarker.pressCount || 1} TIMES
                                        <span className="mx-2 text-gray-400 dark:text-gray-700">|</span>
                                        CLICK PLAY TO LISTEN
                                    </p>
                                </div>
                            </div>

                            {/* Cards Area */}
                            <div className="space-y-6">
                                {(() => {
                                    // Helper to group consecutive indices
                                    const words = selectedMarker.subtitleText?.trim().split(/\s+/).filter(w => w.length > 0) || [];
                                    const markedIndices = selectedMarker.misunderstoodIndices || [];
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
                                                    text: currentGroup.map(idx => cleanToken(words[idx] || '')).filter(Boolean).join(' '),
                                                    mainIndex: currentGroup[0]
                                                });
                                                currentGroup = [sortedIndices[i]];
                                            }
                                        }
                                        groupedItems.push({
                                            indices: currentGroup,
                                            text: currentGroup.map(idx => cleanToken(words[idx] || '')).filter(Boolean).join(' '),
                                            mainIndex: currentGroup[0]
                                        });
                                    }

                                    return groupedItems.map(item => {
                                        const { text, mainIndex } = item;
                                        const data = selectedMarker.vocabData?.[mainIndex] || { definition: '', notes: '' };
                                        const isPhrase = item.indices.length > 1;

                                        return (
                                            <div key={`${selectedMarker.id}-${mainIndex}`} className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden group hover:border-gray-300 dark:hover:border-gray-700 transition-all shadow-sm">
                                                {/* Card Header */}
                                                <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-2 w-2 rounded-full ${isPhrase ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : `bg-${moduleColor}-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]`}`} />
                                                        <span className={`font-bold text-lg ${isPhrase ? 'text-gray-900 dark:text-green-100' : `text-gray-900 dark:text-${moduleColor}-100`}`}>{text}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isPhrase ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300' : `bg-${moduleColor}-100 dark:bg-${moduleColor}-900/40 text-${moduleColor}-600 dark:text-${moduleColor}-300`}`}>
                                                            {isPhrase ? 'PHRASE' : 'WORD'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                    {/* Audio Playback Control */}
                                                    {module !== 'reading' && (
                                                        <div className={`col-span-1 lg:col-span-2 bg-${moduleColor}-50 dark:bg-${moduleColor}-900/10 p-4 rounded-xl border border-${moduleColor}-100 dark:border-${moduleColor}-900/30 flex items-center justify-between`}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 bg-${moduleColor}-100 dark:bg-${moduleColor}-900/20 rounded-full flex items-center justify-center text-${moduleColor}-600 dark:text-${moduleColor}-500`}>
                                                                    <Volume2 size={20} />
                                                                </div>
                                                                <div>
                                                                    <span className={`text-[10px] font-bold text-${moduleColor}-600 dark:text-${moduleColor}-500 uppercase tracking-wider`}>Front (Question)</span>
                                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Audio Clip ({formatTime(selectedMarker.end - selectedMarker.start)})</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => onPlaySegment(selectedMarker.start, selectedMarker.end, selectedMarker.videoId)}
                                                                className={`bg-${moduleColor}-500 hover:bg-${moduleColor}-400 text-black px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors`}
                                                            >
                                                                <Play size={14} fill="currentColor" /> Play
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Back: Answer Fields */}
                                                    <div className="col-span-1 lg:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-6 mt-2">
                                                        <span className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Back (Answer)</span>

                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                            {/* Left: Fields */}
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Expression</label>
                                                                    <div className="bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded p-3 text-gray-800 dark:text-gray-200 font-medium transition-colors">
                                                                        {text}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Right: Meaning with AI */}
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <div className="flex justify-between items-center mb-1.5">
                                                                        <label className="block text-xs font-bold text-gray-500 uppercase">Meaning</label>
                                                                        <button
                                                                            onClick={() => handleGenerateAI(selectedMarker.id, mainIndex, text)}
                                                                            disabled={isGenerating}
                                                                            className="text-[10px] flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors disabled:opacity-50"
                                                                            title="Generate with AI"
                                                                        >
                                                                            <Sparkles size={12} />
                                                                            {isGenerating ? 'Generating...' : 'AI Generate'}
                                                                        </button>
                                                                    </div>
                                                                    <textarea
                                                                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded p-3 text-sm text-gray-900 dark:text-gray-200 focus:border-blue-500 focus:outline-none transition-colors h-32 resize-none"
                                                                        placeholder="Enter definition..."
                                                                        value={data.definition}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (viewMode === 'session') {
                                                                                onUpdateVocabData(selectedMarker.id, mainIndex, 'definition', val);
                                                                            } else {
                                                                                // Database update
                                                                                const currentVocab = selectedMarker.vocabData || {};
                                                                                const currentItem = currentVocab[mainIndex] || { definition: '', notes: '' };
                                                                                const newVocab = {
                                                                                    ...currentVocab,
                                                                                    [mainIndex]: { ...currentItem, definition: val }
                                                                                };
                                                                                onUpdateCard?.(selectedMarker.id, { vocabData: newVocab });
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )
                )}

                {/* Bottom Bar Operations */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3 sticky bottom-0 z-10 transition-colors">
                    <button
                        onClick={() => {
                            if (checkedIds.size > 0 || selectedMarker) {
                                setShowDiscardModal(true);
                            }
                        }}
                        className="px-6 py-2 rounded-lg text-sm font-bold text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                        {viewMode === 'collection' ? (checkedIds.size > 0 ? `Delete Selected (${checkedIds.size})` : 'Delete') : (checkedIds.size > 0 ? `Discard Selected (${checkedIds.size})` : 'Discard')}
                    </button>

                    {viewMode === 'session' && (
                        <button
                            onClick={() => {
                                if (checkedIds.size > 0) {
                                    handleBulkSave();
                                } else if (selectedMarker) {
                                    onSaveToDeck(selectedMarker);
                                    setToast({ message: "Card saved to collection", type: 'success', actionLabel: 'Undo', onAction: () => { } });
                                }
                            }}
                            className={`px-6 py-2 rounded-lg text-sm font-bold bg-${moduleColor}-500 text-black hover:bg-${moduleColor}-400 shadow-lg shadow-${moduleColor}-500/20 transition-all flex items-center gap-2`}
                        >
                            <Save size={16} />
                            {checkedIds.size > 0 ? `Save Selected (${checkedIds.size})` : 'Save to Collection'}
                        </button>
                    )}
                </div>

                {/* Helper Components */}
                {toast && <Toast {...toast} onUnmount={() => setToast(null)} />}
                <Modal
                    isOpen={showDiscardModal}
                    title={checkedIds.size > 0 ? `Delete ${checkedIds.size} Cards?` : (selectedMarker ? "Delete Card?" : "Delete")}
                    description={`This will permanently remove this item from your ${viewMode === 'collection' ? 'saved collection' : 'session queue'}. This action cannot be undone.`}
                    confirmLabel="Delete"
                    isDestructive
                    onConfirm={handleBulkDiscard}
                    onCancel={() => setShowDiscardModal(false)}
                />

                {/* Flashcard Preview Overlay */}
                {isPreviewing && selectedMarker && (
                    <div className="absolute inset-0 z-[60] bg-gray-50 dark:bg-gray-950 animate-in slide-in-from-right duration-300">
                        <FlashcardPractice
                            module={module}
                            savedCards={[selectedMarker]} // Preview just this one
                            onExit={() => setIsPreviewing(false)}
                            onPlayAudio={onPlaySegment}
                            previewMode={true}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-full bg-gray-50 dark:bg-gray-950 overflow-hidden transition-colors">
            {/* Left Sidebar: Review Queue */}
            <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-colors">
                {/* Sidebar Header */}
                <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 transition-colors">
                    {/* Mode Toggle Switch */}
                    <div className="p-3">
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('session')}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${viewMode === 'session'
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                Session
                            </button>
                            <button
                                onClick={() => setViewMode('collection')}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${viewMode === 'collection'
                                    ? `bg-white dark:bg-gray-700 text-${moduleColor}-600 dark:text-${moduleColor}-400 shadow-sm`
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                My Collection
                            </button>
                        </div>
                    </div>

                    {/* Stats Panel (Collection mode only) */}
                    {renderStatsPanel()}

                    {/* Search and Filter */}
                    <div className="p-3 space-y-2">
                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search vocabulary..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-gray-800 border-0 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Filter/Sort Row */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${showFilters
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                    }`}
                            >
                                <Filter size={12} /> Filter
                            </button>
                            <div className="flex-1 relative">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as VocabSortOption)}
                                    className="w-full appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 px-3 pr-8 text-xs font-medium text-gray-600 dark:text-gray-400 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="most-practiced">Most Practiced</option>
                                    {viewMode === 'collection' && <option value="due-first">Due First</option>}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Expanded Filters */}
                        {showFilters && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Source</label>
                                    <div className="flex gap-1">
                                        {(['all', 'loop', 'shadow'] as FilterSource[]).map(source => (
                                            <button
                                                key={source}
                                                onClick={() => setFilterSource(source)}
                                                className={`flex-1 py-1 text-[10px] font-medium rounded transition-colors ${filterSource === source
                                                    ? `bg-${moduleColor}-500 text-black`
                                                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {source.charAt(0).toUpperCase() + source.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Header Controls */}
                    <div className="px-3 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSelectAll}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                title="Select All"
                            >
                                {checkedIds.size === filteredMarkers.length && filteredMarkers.length > 0 ? (
                                    <CheckCircle2 size={16} className="text-blue-500" />
                                ) : (
                                    <Circle size={16} />
                                )}
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {filteredMarkers.length} items
                            </span>
                        </div>
                        {viewMode === 'collection' && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setQueueOnly(prev => !prev)}
                                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${queueOnly
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                    title="Show only cards in current flashcard queue"
                                >
                                    <Filter size={12} />
                                    {isQueueLoading ? 'Queue...' : queueOnly ? `Queue Only (${queueIds.length})` : `Queue (${queueIds.length})`}
                                </button>
                                {onProcessQueue && queueIds.length > 0 && (
                                    <button
                                        onClick={onProcessQueue}
                                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                        title="Go directly to flashcard queue"
                                    >
                                        <Play size={12} fill="currentColor" /> Process Queue
                                    </button>
                                )}
                                <button
                                    onClick={handleExport}
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                    title="Export vocabulary"
                                >
                                    <Download size={12} /> Export
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredMarkers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-600 text-sm">
                            {searchQuery
                                ? 'No matching items found.'
                                : viewMode === 'collection' && queueOnly
                                    ? 'No cards in the current flashcard queue.'
                                    : 'No items available.'}
                        </div>
                    ) : (
                        filteredMarkers.map(renderSidebarItem)
                    )}
                </div>
            </div>

            {/* Right Pane: Workbench */}
            {renderWorkbench()}
        </div>
    );
};

export default VocabularyManager;

// Tailwind Safelist for dynamic classes
// text-yellow-500 text-blue-500 text-green-500 text-purple-500
// text-yellow-600 text-blue-600 text-green-600 text-purple-600
// text-yellow-700 text-blue-700 text-green-700 text-purple-700
// bg-yellow-50 bg-blue-50 bg-green-50 bg-purple-50
// bg-yellow-100 bg-blue-100 bg-green-100 bg-purple-100
// bg-yellow-400 bg-blue-400 bg-green-400 bg-purple-400
// bg-yellow-500 bg-blue-500 bg-green-500 bg-purple-500
// bg-yellow-500/20 bg-blue-500/20 bg-green-500/20 bg-purple-500/20
// border-yellow-100 border-blue-100 border-green-100 border-purple-100
// border-yellow-200 border-blue-200 border-green-200 border-purple-200
// border-yellow-500 border-blue-500 border-green-500 border-purple-500
// shadow-yellow-500/20 shadow-blue-500/20 shadow-green-500/20 shadow-purple-500/20
// hover:bg-yellow-400 hover:bg-blue-400 hover:bg-green-400 hover:bg-purple-400
// from-yellow-50 from-blue-50 from-green-50 from-purple-50
// to-yellow-100/50 to-blue-100/50 to-green-100/50 to-purple-100/50
// dark:from-yellow-900/20 dark:from-blue-900/20 dark:from-green-900/20 dark:from-purple-900/20
// dark:to-yellow-900/10 dark:to-blue-900/10 dark:to-green-900/10 dark:to-purple-900/10
// dark:bg-yellow-900/10 dark:bg-blue-900/10 dark:bg-green-900/10 dark:bg-purple-900/10
// dark:bg-yellow-900/30 dark:bg-blue-900/30 dark:bg-green-900/30 dark:bg-purple-900/30
// dark:bg-yellow-900/20 dark:bg-blue-900/20 dark:bg-green-900/20 dark:bg-purple-900/20
// dark:bg-yellow-900/40 dark:bg-blue-900/40 dark:bg-green-900/40 dark:bg-purple-900/40
// dark:bg-yellow-500/20 dark:bg-blue-500/20 dark:bg-green-500/20 dark:bg-purple-500/20
// dark:text-yellow-100 dark:text-blue-100 dark:text-green-100 dark:text-purple-100
// dark:text-yellow-300 dark:text-blue-300 dark:text-green-300 dark:text-purple-300
// dark:text-yellow-400 dark:text-blue-400 dark:text-green-400 dark:text-purple-400
// dark:text-yellow-500 dark:text-blue-500 dark:text-green-500 dark:text-purple-500
// dark:border-yellow-900/50 dark:border-blue-900/50 dark:border-green-900/50 dark:border-purple-900/50
// dark:border-yellow-900/30 dark:border-blue-900/30 dark:border-green-900/30 dark:border-purple-900/30
// dark:border-yellow-500/30 dark:border-blue-500/30 dark:border-green-500/30 dark:border-purple-500/30
