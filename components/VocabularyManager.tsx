import React, { useMemo, useState } from 'react';
import { Marker } from '../types';
import { BookOpen, Activity, Play, Trash2, Save, Flag, Volume2 } from 'lucide-react';
import { formatTime } from '../utils';

interface VocabularyManagerProps {
    markers: Marker[];
    onRemoveWord: (word: string) => void;
    onUpdateVocabData: (markerId: string, index: number, field: 'definition' | 'notes', value: string) => void;
    onPlaySegment: (start: number, end: number) => void;
}

const VocabularyManager: React.FC<VocabularyManagerProps> = ({
    markers,
    onUpdateVocabData,
    onPlaySegment
}) => {
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

    // 1. Get all markers with marked words
    const activeMarkers = useMemo(() => {
        return markers.filter(m => m.misunderstoodIndices && m.misunderstoodIndices.length > 0)
            .sort((a, b) => a.createdAt - b.createdAt); // Oldest first
    }, [markers]);

    // Select first marker by default if none selected
    if (!selectedMarkerId && activeMarkers.length > 0) {
        setSelectedMarkerId(activeMarkers[0].id);
    }

    const selectedMarker = activeMarkers.find(m => m.id === selectedMarkerId) || activeMarkers[0];

    const renderSidebarItem = (marker: Marker) => {
        const isSelected = selectedMarkerId === marker.id;
        const subtitleSnippet = marker.subtitleText ? (marker.subtitleText.length > 45 ? marker.subtitleText.substr(0, 45) + '...' : marker.subtitleText) : "No text";

        const markedCount = marker.misunderstoodIndices?.length || 0;
        const pressCount = marker.pressCount || 1;

        let dotColor = "text-gray-500";
        if (pressCount > 3) dotColor = "text-yellow-500";
        if (pressCount > 6) dotColor = "text-red-500";

        return (
            <div
                key={marker.id}
                onClick={() => setSelectedMarkerId(marker.id)}
                className={`
                p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50
                ${isSelected ? 'bg-gray-100 dark:bg-gray-800 border-l-4 border-l-yellow-500' : 'border-l-4 border-l-transparent'}
            `}
            >
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">#{marker.id.substr(0, 4)}</span>
                    <div className="flex gap-1" title={`${pressCount} attempts`}>
                        {[...Array(Math.min(3, pressCount))].map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full bg-current ${dotColor}`} />
                        ))}
                    </div>
                </div>
                <p className={`text-sm leading-snug ${isSelected ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                    {subtitleSnippet}
                </p>
                <div className="mt-2 flex items-center gap-2">
                    {markedCount > 0 && (
                        <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/50">
                            {markedCount} Marked
                        </span>
                    )}
                    <span className="text-[10px] text-gray-500 dark:text-gray-600 font-mono">
                        {formatTime(marker.start)} - {formatTime(marker.end)}
                    </span>
                </div>
            </div>
        );
    };

    const renderWorkbench = () => {
        if (!selectedMarker) return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                No review items selected.
            </div>
        );

        const words = selectedMarker.subtitleText?.trim().split(/\s+/).filter(w => w.length > 0) || [];
        const markedIndices = selectedMarker.misunderstoodIndices || [];

        return (

            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors">
                {/* Header / ID Bar */}
                <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 shrink-0 transition-colors">
                    <div className="flex items-center gap-3">
                        <BookOpen className="text-yellow-500" size={20} />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sentence Workbench</h2>
                        <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded text-xs font-mono">ID: {selectedMarker.id}</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onPlaySegment(selectedMarker.start, selectedMarker.end)}
                            className="flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 rounded text-sm transition-colors border border-gray-300 dark:border-gray-700 shadow-sm"
                        >
                            <Volume2 size={14} /> Play Audio
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                    {/* Sentence Display */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 mb-8 shadow-sm transition-colors">
                        <div className="flex flex-wrap gap-2 text-2xl leading-relaxed text-gray-800 dark:text-gray-300 font-medium justify-center text-center">
                            {words.map((word, i) => {
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
                                            {/* Left: Fields */}
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Expression / Front</label>
                                                    <div className="bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded p-3 text-gray-800 dark:text-gray-200 font-medium transition-colors">
                                                        {text}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Meaning / Back</label>
                                                    <textarea
                                                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded p-3 text-sm text-gray-900 dark:text-gray-200 focus:border-blue-500 focus:outline-none transition-colors h-24 resize-none"
                                                        placeholder="Enter definition..."
                                                        value={data.definition}
                                                        onChange={(e) => onUpdateVocabData(selectedMarker.id, mainIndex, 'definition', e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Right: Context & Audio */}
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Context / Notes</label>
                                                    <textarea
                                                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded p-3 text-sm text-gray-900 dark:text-gray-200 focus:border-blue-500 focus:outline-none transition-colors h-24 resize-none"
                                                        placeholder="E.g. Speaker clipped the vowel..."
                                                        value={data.notes}
                                                        onChange={(e) => onUpdateVocabData(selectedMarker.id, mainIndex, 'notes', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Action Bar */}
                <div className="h-16 border-t border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900/50 flex items-center justify-between px-8 shrink-0 transition-colors">
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-500">
                        <span className="flex items-center gap-1.5"><Flag size={14} /> PRIORITY: HIGH</span>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                            Discard
                        </button>
                        <button className="px-4 py-2 rounded-lg text-sm font-bold bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/20 transition-all flex items-center gap-2">
                            <Save size={16} /> Save to Deck
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full bg-gray-50 dark:bg-gray-950 overflow-hidden transition-colors">
            {/* Left Sidebar: Review Queue */}
            <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-colors">
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Review Queue ({activeMarkers.length})</span>
                    <Flag size={14} className="text-gray-400 dark:text-gray-600" />
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
