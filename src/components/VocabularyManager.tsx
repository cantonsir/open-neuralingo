import React, { useMemo, useState } from 'react';
import { Marker } from '../types';
import { BookOpen, Activity, Play, Trash2, Save, Flag, Volume2, Sparkles, CheckCircle2, Circle, Eye } from 'lucide-react';
import { formatTime } from '../utils';
import { generateDefinition } from '../ai';
import Toast from './Toast';
import Modal from './Modal';
import FlashcardPractice from './FlashcardPractice';

interface VocabularyManagerProps {
    markers: Marker[];
    savedCards?: Marker[]; // New prop for DB cards
    onRemoveWord: (word: string) => void;
    onUpdateVocabData: (markerId: string, index: number, field: 'definition' | 'notes', value: string) => void;
    onPlaySegment: (start: number, end: number) => void;
    onSaveToDeck: (marker: Marker) => void;
    onDeleteCard?: (id: string) => void; // New prop for DB delete
    onUpdateCard?: (id: string, updates: Partial<Marker>) => void; // New prop for DB update
    onDiscardSessionMarker?: (id: string) => void; // Prop for session discard
}

const VocabularyManager: React.FC<VocabularyManagerProps> = ({
    markers,
    savedCards = [],
    onRemoveWord,
    onUpdateVocabData,
    onPlaySegment,
    onSaveToDeck,
    onDeleteCard,
    onUpdateCard,
    onDiscardSessionMarker
}) => {
    const [viewMode, setViewMode] = useState<'session' | 'database'>('session');
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Bulk Items State
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

    // UI State
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', actionLabel?: string, onAction?: () => void } | null>(null);
    const [showDiscardModal, setShowDiscardModal] = useState(false);

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
        if (checkedIds.size === activeMarkers.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(activeMarkers.map(m => m.id)));
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
            // Database Mode: Delete !
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
        const markersToSave = activeMarkers.filter(m => checkedIds.has(m.id));
        markersToSave.forEach(m => onSaveToDeck(m));
        setToast({ message: `${markersToSave.length} cards saved to deck`, type: 'success', actionLabel: 'Undo', onAction: () => { } });
        setCheckedIds(new Set()); // Clear selection after save
    };

    // 1. Get List based on View Mode
    const activeMarkers = useMemo(() => {
        const source = viewMode === 'session' ? markers : savedCards;
        return source.filter(m => m.misunderstoodIndices && m.misunderstoodIndices.length > 0)
            .sort((a, b) => b.createdAt - a.createdAt); // Newest first for better UX
    }, [markers, savedCards, viewMode]);

    // Select first marker by default if none selected
    if (!selectedMarkerId && activeMarkers.length > 0) {
        setSelectedMarkerId(activeMarkers[0].id);
    }

    const selectedMarker = activeMarkers.find(m => m.id === selectedMarkerId) || activeMarkers[0];

    const renderSidebarItem = (marker: Marker) => {
        const isSelected = selectedMarkerId === marker.id;
        const subtitleSnippet = marker.subtitleText ? (marker.subtitleText.length > 45 ? marker.subtitleText.substr(0, 45) + '...' : marker.subtitleText) : "No text";

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

        let dotColor = "text-gray-500";
        if (pressCount > 3) dotColor = "text-yellow-500";
        if (pressCount > 6) dotColor = "text-red-500";

        const badgeColorClass = hasPhrase
            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 border-green-200 dark:border-green-900/50"
            : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 border-red-200 dark:border-red-900/50";

        return (
            <div
                key={marker.id}
                onClick={() => setSelectedMarkerId(marker.id)}
                className={`p-4 cursor-pointer border-l-4 transition-all group relative ${isSelected
                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-500'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
            >
                {/* Hover Checkbox */}
                <div
                    className={`absolute left-2 top-4 z-20 transition-opacity duration-200 ${checkedIds.has(marker.id) || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={(e) => toggleCheck(marker.id, e)}
                >
                    {checkedIds.has(marker.id) ? (
                        <CheckCircle2 size={16} className="text-blue-500 fill-blue-50 dark:fill-blue-900" />
                    ) : (
                        <Circle size={16} className="text-gray-300 hover:text-gray-400" />
                    )}
                </div>

                <div className={`flex justify-between items-start mb-1 pl-6`}>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">#{marker.id.substr(0, 4)}</span>
                    <div className="flex gap-1" title={`${pressCount} attempts`}>
                        {[...Array(Math.min(3, pressCount))].map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full bg-current ${dotColor}`} />
                        ))}
                    </div>
                </div>
                <p className={`text-sm leading-snug pl-6 ${isSelected ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                    {subtitleSnippet}
                </p>
                <div className="mt-2 flex items-center gap-2 pl-6">
                    {conceptualCount > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColorClass}`}>
                            {conceptualCount} Marked
                        </span>
                    )}
                    <span className="text-[10px] text-gray-500 dark:text-gray-600 font-mono">
                        {formatTime(marker.start)} - {formatTime(marker.end)}
                    </span>
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
                const marker = activeMarkers.find(m => m.id === markerId);
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
                            <BookOpen className="text-yellow-500" size={20} />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sentence Workbench</h2>
                            <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded text-xs font-mono">ID: {selectedMarker.id}</span>
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
                            You can save these directly to your deck or discard them in bulk.
                        </p>
                    </div>
                ) : (
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
                                                        : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-100 border border-red-200 dark:border-red-500/30')
                                                    : 'hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                                                }
                                        `}
                                        >
                                            {word}
                                            {isMarked && (
                                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPhrasePart ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isPhrasePart ? 'bg-green-500' : 'bg-red-500'}`}></span>
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

                                return groupedItems.map(item => {
                                    const { text, mainIndex } = item;
                                    const data = selectedMarker.vocabData?.[mainIndex] || { definition: '', notes: '' };
                                    const isPhrase = item.indices.length > 1;

                                    return (
                                        <div key={`${selectedMarker.id}-${mainIndex}`} className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden group hover:border-gray-300 dark:hover:border-gray-700 transition-all shadow-sm">
                                            {/* Card Header */}
                                            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-2 w-2 rounded-full ${isPhrase ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
                                                    <span className={`font-bold text-lg ${isPhrase ? 'text-gray-900 dark:text-green-100' : 'text-gray-900 dark:text-red-100'}`}>{text}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isPhrase ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300'}`}>
                                                        {isPhrase ? 'PHRASE' : 'WORD'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Card Body */}
                                            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                {/* Front: Audio */}
                                                <div className="col-span-1 lg:col-span-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-yellow-100 dark:bg-yellow-500/20 p-2 rounded-full text-yellow-600 dark:text-yellow-500">
                                                            <Volume2 size={20} />
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-widest">Front (Question)</span>
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio Clip ({formatTime(selectedMarker.end - selectedMarker.start)})</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => onPlaySegment(selectedMarker.start, selectedMarker.end)}
                                                        className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-lg shadow-sm hover:bg-yellow-400 transition-colors flex items-center gap-2 text-xs"
                                                    >
                                                        <Play size={14} fill="currentColor" /> Play
                                                    </button>
                                                </div>

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
                        {viewMode === 'database' ? (checkedIds.size > 0 ? `Delete Selected (${checkedIds.size})` : 'Delete') : (checkedIds.size > 0 ? `Discard Selected (${checkedIds.size})` : 'Discard')}
                    </button>

                    {viewMode === 'session' && (
                        <button
                            onClick={() => {
                                if (checkedIds.size > 0) {
                                    handleBulkSave();
                                } else if (selectedMarker) {
                                    onSaveToDeck(selectedMarker);
                                    setToast({ message: "Card saved to deck", type: 'success', actionLabel: 'Undo', onAction: () => { } });
                                }
                            }}
                            className="px-6 py-2 rounded-lg text-sm font-bold bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/20 transition-all flex items-center gap-2"
                        >
                            <Save size={16} />
                            {checkedIds.size > 0 ? `Save Selected (${checkedIds.size})` : 'Save to Deck'}
                        </button>
                    )}
                </div>

                {/* Helper Components */}
                {toast && <Toast {...toast} onUnmount={() => setToast(null)} />}
                <Modal
                    isOpen={showDiscardModal}
                    title={checkedIds.size > 0 ? `Delete ${checkedIds.size} Cards?` : (selectedMarker ? "Delete Card?" : "Delete")}
                    description={`This will permanently remove this item from your ${viewMode === 'database' ? 'saved database' : 'session queue'}. This action cannot be undone.`}
                    confirmLabel="Discard"
                    isDestructive
                    onConfirm={handleBulkDiscard}
                    onCancel={() => setShowDiscardModal(false)}
                />

                {/* Flashcard Preview Overlay */}
                {isPreviewing && selectedMarker && (
                    <div className="absolute inset-0 z-[60] bg-gray-50 dark:bg-gray-950 animate-in slide-in-from-right duration-300">
                        <FlashcardPractice
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
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-4 bg-white dark:bg-gray-900 sticky top-0 z-10 transition-colors">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSelectAll}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                title="Select All"
                            >
                                {checkedIds.size === activeMarkers.length && activeMarkers.length > 0 ? (
                                    <CheckCircle2 size={18} className="text-blue-500" />
                                ) : (
                                    <Circle size={18} />
                                )}
                            </button>
                            <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                {viewMode === 'session' ? 'Session Queue' : 'Saved Database'} ({activeMarkers.length})
                            </h2>
                        </div>
                        <Flag size={14} className="text-gray-300" />
                    </div>

                    {/* Mode Toggle Switch */}
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('session')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'session'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Session
                        </button>
                        <button
                            onClick={() => setViewMode('database')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'database'
                                ? 'bg-white dark:bg-gray-700 text-yellow-600 dark:text-yellow-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Database
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeMarkers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-600 text-sm">
                            No items in queue.
                        </div>
                    ) : (
                        activeMarkers.map(renderSidebarItem)
                    )}
                </div>
            </div>

            {/* Right Pane: Workbench */}
            {renderWorkbench()}
        </div>
    );
};

export default VocabularyManager;
