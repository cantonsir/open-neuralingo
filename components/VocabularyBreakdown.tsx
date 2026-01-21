import React from 'react';

import { MousePointer2 } from 'lucide-react';

interface VocabularyBreakdownProps {
    text: string;
    markedIndices: number[];
    onToggleWord: (index: number) => void;
    onToggleRange?: (start: number, end: number) => void;
}

const VocabularyBreakdown: React.FC<VocabularyBreakdownProps> = ({
    text,
    markedIndices,
    onToggleWord,
    onToggleRange
}) => {
    // Split by space and filter empty strings to avoid blank blocks
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);

    const [isPhraseMode, setIsPhraseMode] = React.useState(false);
    const [selectionStart, setSelectionStart] = React.useState<number | null>(null);

    const handleWordClick = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();

        if (isPhraseMode && onToggleRange) {
            if (selectionStart === null) {
                setSelectionStart(index);
            } else {
                onToggleRange(selectionStart, index);
                setSelectionStart(null);
                // Optional: Turn off phrase mode after selection? 
                // setIsPhraseMode(false); 
            }
        } else {
            onToggleWord(index);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Interactive Transcript
                </div>
                {onToggleRange && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsPhraseMode(!isPhraseMode);
                            setSelectionStart(null);
                        }}
                        className={`
                            flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded border transition-all
                            ${isPhraseMode
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                            }
                        `}
                    >
                        <MousePointer2 size={12} />
                        {isPhraseMode ? (selectionStart !== null ? 'Click End Word' : 'Select Start Word') : 'Select Phrase'}
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {words.map((word, index) => {
                    const isMarked = markedIndices.includes(index);
                    const isSelectionStart = selectionStart === index;

                    // Highlight range preview if start is selected
                    // (Optional enhancement, for now just highlight start)

                    return (
                        <button
                            key={`${index}-${word}`}
                            onClick={(e) => handleWordClick(index, e)}
                            className={`
                                px-2 py-1 rounded border text-sm transition-all duration-200 relative
                                ${isMarked
                                    ? ((isMarked && (markedIndices.includes(index - 1) || markedIndices.includes(index + 1)))
                                        ? 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 font-medium'
                                        : 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 font-medium')
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
                                }
                                ${isSelectionStart ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-gray-900 border-indigo-500' : ''}
                            `}
                        >
                            {word}
                            {isSelectionStart && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <div className="text-[10px] text-gray-600 italic mt-1">
                {isPhraseMode
                    ? "Click the first word, then the last word of the phrase."
                    : "Click words you misunderstood."}
            </div>
        </div>
    );
};

export default VocabularyBreakdown;
