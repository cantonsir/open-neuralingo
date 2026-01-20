import React from 'react';

interface VocabularyBreakdownProps {
    text: string;
    markedIndices: number[];
    onToggleWord: (index: number) => void;
}

const VocabularyBreakdown: React.FC<VocabularyBreakdownProps> = ({
    text,
    markedIndices,
    onToggleWord
}) => {
    // Split by space but preserve punctuation logic could be added later.
    // For now, simple space split to get clickable "blocks".
    const words = text.split(/\s+/);

    return (
        <div className="space-y-2">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Interactive Transcript
            </div>
            <div className="flex flex-wrap gap-2">
                {words.map((word, index) => {
                    const isMarked = markedIndices.includes(index);
                    return (
                        <button
                            key={`${index}-${word}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleWord(index);
                            }}
                            className={`
                px-2 py-1 rounded border text-sm transition-all duration-200
                ${isMarked
                                    ? 'bg-red-500/10 border-red-500 text-red-400 font-medium'
                                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                                }
              `}
                        >
                            {word}
                        </button>
                    );
                })}
            </div>
            <div className="text-[10px] text-gray-600 italic mt-1">
                Click words you misunderstood to analyze them.
            </div>
        </div>
    );
};

export default VocabularyBreakdown;
