import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, BookOpen, Trash2 } from 'lucide-react';
import { ReadingProfileData } from './ReadingProfile';
import { GeneratedPassage, generateReadingTestPassages } from '../../services/geminiService';
import { useReadingTest, ReadingTestResponse } from '../../hooks/useReadingTest';

interface ReadingMiniTestProps {
    profile: ReadingProfileData;
    onComplete: (responses: ReadingTestResponse[], passages: GeneratedPassage[]) => void;
    onBack?: () => void;
}

type SelectionType = 'word' | 'sentence' | null;

const ReadingMiniTest: React.FC<ReadingMiniTestProps> = ({ profile, onComplete, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [passages, setPassages] = useState<GeneratedPassage[]>([]);
    const [selectedText, setSelectedText] = useState('');
    const [selectionType, setSelectionType] = useState<SelectionType>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const {
        currentIndex,
        currentPassage,
        markedWords,
        markedSentences,
        markedWordIndices,
        markedSentenceIndices,
        totalPassages,
        toggleWordMark,
        toggleSentenceMark,
        addMarkedWord,
        addMarkedSentence,
        removeMarkedWord,
        removeMarkedSentence,
        clearAllMarkings,
        handleNextPassage,
        handlePreviousPassage,
        handleScroll,
    } = useReadingTest({
        passages,
        onComplete,
    });

    // Load passages on mount
    useEffect(() => {
        const loadPassages = async () => {
            setLoading(true);
            try {
                const generatedPassages = await generateReadingTestPassages(profile, 5);
                setPassages(generatedPassages);
            } catch (error) {
                console.error('Error generating passages:', error);
            }
            setLoading(false);
        };

        loadPassages();
    }, [profile]);

    // Handle text selection
    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
            setSelectedText('');
            setSelectionType(null);
            return;
        }

        const text = selection.toString().trim();
        setSelectedText(text);

        // Auto-detect if it's a sentence (ends with punctuation)
        const isSentence = /[.!?]$/.test(text);
        setSelectionType(isSentence ? 'sentence' : 'word');
    };

    // Handle marking word
    const handleMarkWord = () => {
        if (!selectedText || !currentPassage) return;

        // Extract context (simplified - in production, use proper sentence extraction)
        const sentences = currentPassage.content.split(/[.!?]+/);
        const sentenceWithWord = sentences.find(s => s.includes(selectedText)) || selectedText;

        // Find word indices (simplified - in production, use proper word indexing)
        const words = currentPassage.content.split(/\s+/);
        const wordIndices: number[] = [];
        words.forEach((word, idx) => {
            if (selectedText.includes(word)) {
                wordIndices.push(idx);
            }
        });

        const type = selectedText.split(/\s+/).length > 1 ? 'phrase' : 'word';

        addMarkedWord(selectedText, sentenceWithWord, 0, wordIndices, type);

        // Clear selection
        window.getSelection()?.removeAllRanges();
        setSelectedText('');
    };

    // Handle marking sentence
    const handleMarkSentence = () => {
        if (!selectedText || !currentPassage) return;

        // Find sentence index (simplified)
        const sentences = currentPassage.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const sentenceIndex = sentences.findIndex(s => selectedText.includes(s.trim()));

        addMarkedSentence(selectedText, 0, sentenceIndex >= 0 ? sentenceIndex : 0);

        // Clear selection
        window.getSelection()?.removeAllRanges();
        setSelectedText('');
    };

    // Handle scroll for re-read detection
    const handleContentScroll = () => {
        if (contentRef.current) {
            const { scrollTop, scrollHeight } = contentRef.current;
            handleScroll(scrollTop, scrollHeight);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Generating personalized passages...</p>
                </div>
            </div>
        );
    }

    if (!currentPassage) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <p className="text-gray-600 dark:text-gray-400">No passages available</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        Reading Assessment
                    </h2>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Passage {currentIndex + 1} of {totalPassages}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${((currentIndex + 1) / totalPassages) * 100}%` }}
                    />
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Passage content */}
                <div
                    ref={contentRef}
                    className="flex-1 overflow-y-auto p-8"
                    onScroll={handleContentScroll}
                    onMouseUp={handleTextSelection}
                >
                    <div className="max-w-3xl mx-auto">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            {currentPassage.title}
                        </h3>

                        <div className="prose dark:prose-invert max-w-none">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap select-text">
                                {currentPassage.content}
                            </p>
                        </div>

                        {/* Word count info */}
                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                            {currentPassage.wordCount} words • {currentPassage.sentenceCount} sentences
                            • Level {currentPassage.difficulty}/5
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
                    {/* Selection actions */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        {selectedText ? (
                            <div className="space-y-3">
                                <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded">
                                    <div className="font-medium mb-1">Selected:</div>
                                    <div className="italic">"{selectedText.substring(0, 50)}{selectedText.length > 50 ? '...' : ''}"</div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleMarkWord}
                                        className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm font-medium transition-colors"
                                    >
                                        Mark Word
                                    </button>
                                    <button
                                        onClick={handleMarkSentence}
                                        className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-medium transition-colors"
                                    >
                                        Mark Sentence
                                    </button>
                                </div>

                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                    {selectionType === 'word' ? '💛 Vocabulary issue' : '🧡 Grammar/structure issue'}
                                </p>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                Select text to mark words or sentences
                            </div>
                        )}
                    </div>

                    {/* Marked items */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Marked words */}
                        {markedWords.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    💛 Marked Words ({markedWords.length})
                                </h4>
                                <div className="space-y-2">
                                    {markedWords.map((word, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 text-sm"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="font-medium text-yellow-900 dark:text-yellow-100">
                                                    {word.text}
                                                </div>
                                                <button
                                                    onClick={() => removeMarkedWord(idx)}
                                                    className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 italic">
                                                "{word.sentenceContext.substring(0, 60)}..."
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Marked sentences */}
                        {markedSentences.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    🧡 Marked Sentences ({markedSentences.length})
                                </h4>
                                <div className="space-y-2">
                                    {markedSentences.map((sentence, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2 text-sm"
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <div className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                                    Sentence {sentence.sentenceIndex + 1}
                                                </div>
                                                <button
                                                    onClick={() => removeMarkedSentence(idx)}
                                                    className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="text-xs text-orange-800 dark:text-orange-200 italic">
                                                "{sentence.text.substring(0, 80)}..."
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {markedWords.length === 0 && markedSentences.length === 0 && (
                            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                                No marked items yet
                            </div>
                        )}

                        {(markedWords.length > 0 || markedSentences.length > 0) && (
                            <button
                                onClick={clearAllMarkings}
                                className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded transition-colors"
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    {/* Reading time */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span>Take your time reading carefully</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer navigation */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={handlePreviousPassage}
                        disabled={currentIndex === 0}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Previous
                    </button>

                    <button
                        onClick={handleNextPassage}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        {currentIndex < totalPassages - 1 ? (
                            <>
                                Next Passage
                                <ChevronRight className="w-5 h-5" />
                            </>
                        ) : (
                            'Complete Test'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReadingMiniTest;
