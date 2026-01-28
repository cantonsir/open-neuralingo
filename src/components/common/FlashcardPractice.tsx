import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Volume2, ArrowLeft } from 'lucide-react';
import { Marker } from '../../types';
import { FlashcardModule } from '../../db';

interface FlashcardPracticeProps {
    module: FlashcardModule;
    savedCards: Marker[];
    onExit: () => void;
    onPlayAudio: (start: number, end: number, videoId?: string) => void;
    previewMode?: boolean;
}

const FlashcardPractice: React.FC<FlashcardPracticeProps> = ({ module, savedCards, onExit, onPlayAudio, previewMode = false }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    // Calculate progress for the top bar
    const progress = savedCards.length > 0 ? ((currentIndex) / savedCards.length) * 100 : 0;
    const currentCard = savedCards[currentIndex];

    // Reset loop when deck changes
    useEffect(() => {
        setCurrentIndex(0);
        setIsFlipped(false);
    }, [savedCards]);

    // Auto-play audio when card loads (Optional, but good for flow)
    // useEffect(() => {
    //     if (currentCard && !isFlipped) {
    //          handlePlayAudio();
    //     }
    // }, [currentIndex, isFlipped]);

    const handlePlayAudio = () => {
        if (currentCard) {
            onPlayAudio(currentCard.start, currentCard.end, currentCard.videoId);
        }
    };

    const handleNext = () => {
        if (currentIndex < savedCards.length - 1) {
            setIsFlipped(false);
            setCurrentIndex(prev => prev + 1);
        } else {
            alert("Session Complete!");
            onExit();
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

    if (!currentCard) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-950 p-8 text-center transition-colors">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-4">Deck Empty</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm capitalize">No cards saved in {module} module yet.</p>
                <button
                    onClick={onExit}
                    className="text-blue-500 hover:underline"
                >
                    Go back
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 font-sans transition-colors relative">
            {/* Top Bar: Progress & Exit (Hidden in Preview Mode) */}
            {!previewMode && (
                <div className="absolute top-0 left-0 right-0 p-6 z-10 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">
                        <button onClick={onExit} className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-2">
                            <ArrowLeft size={16} /> Session Progress
                        </button>
                        <span>{currentIndex + 1} / {savedCards.length}</span>
                    </div>
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
                <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">

                    {/* The Card */}
                    <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-xl dark:shadow-2xl border border-gray-100 dark:border-gray-800 p-12 min-h-[400px] flex flex-col items-center justify-center text-center transition-all duration-500 relative overflow-hidden">

                        {/* Audio Icon (Front Identity) */}
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


                        {/* Separator / Reveal Area */}
                        {isFlipped && (
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
                        {/* SRS Buttons */}
                        <button onClick={handleNext} className="flex flex-col items-center gap-1 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-200 dark:hover:border-red-900/30 transition-all group">
                            <span className="text-sm font-bold text-red-500 group-hover:text-red-600">Again</span>
                            <span className="text-[10px] text-gray-400 group-hover:text-red-400/70">&lt; 1 min</span>
                        </button>

                        <button onClick={handleNext} className="flex flex-col items-center gap-1 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/10 hover:border-orange-200 dark:hover:border-orange-900/30 transition-all group">
                            <span className="text-sm font-bold text-orange-500 group-hover:text-orange-600">Hard</span>
                            <span className="text-[10px] text-gray-400 group-hover:text-orange-400/70">2 days</span>
                        </button>

                        <button onClick={handleNext} className={`flex flex-col items-center gap-1 py-3 bg-${moduleColor}-400 border border-${moduleColor}-500 rounded-xl shadow-lg shadow-${moduleColor}-500/20 hover:bg-${moduleColor}-300 transition-all transform hover:-translate-y-1`}>
                            <span className="text-sm font-bold text-black">Good</span>
                            <span className={`text-[10px] text-${moduleColor}-800 font-medium`}>4 days</span>
                        </button>

                        <button onClick={handleNext} className="flex flex-col items-center gap-1 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-green-200 dark:hover:border-green-900/30 transition-all group">
                            <span className="text-sm font-bold text-green-500 group-hover:text-green-600">Easy</span>
                            <span className="text-[10px] text-gray-400 group-hover:text-green-400/70">7 days</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlashcardPractice;
