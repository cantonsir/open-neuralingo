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

    const [lastClickedIndex, setLastClickedIndex] = React.useState<number | null>(null);

    const handleWordClick = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();

        if (e.shiftKey && lastClickedIndex !== null && onToggleRange) {
            onToggleRange(lastClickedIndex, index);
            setLastClickedIndex(null); // Reset after range selection
        } else {
            onToggleWord(index);
            setLastClickedIndex(index);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Interactive Transcript
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1">
                    <span className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-1 rounded text-[9px] font-mono">Shift</span> + Click to select phrase
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {words.map((word, index) => {
                    const isMarked = markedIndices.includes(index);

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
                            `}
                        >
                            {word}
                        </button>
                    );
                })}
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-600 italic mt-1">
                Click words you misunderstood.
            </div>
        </div>
    );
};

export default VocabularyBreakdown;
