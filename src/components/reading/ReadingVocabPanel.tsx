import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Sparkles, Languages, Save, Trash2 } from 'lucide-react';
import { Marker, VocabData } from '../../types';
import { generateBilingualDefinition, generateSentenceMeaning } from '../../ai';
import VocabularyBreakdown from '../listening/VocabularyBreakdown';

interface ReadingVocabPanelProps {
    selectedText: string | null;
    selectedSentence: string | null;
    selectionIndices: number[] | null;
    sessionMarkers: Marker[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onSaveSelection: () => void;
    onRemoveMarker: (markerId: string) => void;
    onUpdateVocabData: (markerId: string, index: number, data: VocabData) => void;
    firstLanguage?: string;
}

export default function ReadingVocabPanel({
    selectedText,
    selectedSentence,
    selectionIndices,
    sessionMarkers,
    isCollapsed,
    onToggleCollapse,
    onSaveSelection,
    onRemoveMarker,
    onUpdateVocabData,
    firstLanguage = 'en'
}: ReadingVocabPanelProps) {
    const [wordDefinition, setWordDefinition] = useState<string>('');
    const [sentenceMeaning, setSentenceMeaning] = useState<string>('');
    const [isGeneratingWord, setIsGeneratingWord] = useState(false);
    const [isGeneratingSentence, setIsGeneratingSentence] = useState(false);

    // Reset definitions when selection changes
    useEffect(() => {
        if (!selectedText) {
            setWordDefinition('');
            setSentenceMeaning('');
        }
    }, [selectedText]);

    const handleGenerateDefinition = async () => {
        if (!selectedText) return;
        setIsGeneratingWord(true);
        try {
            const definition = await generateBilingualDefinition(selectedText, selectedSentence || '', firstLanguage);
            setWordDefinition(definition || 'Could not generate definition');
        } catch (error) {
            setWordDefinition('Error generating definition');
        } finally {
            setIsGeneratingWord(false);
        }
    };

    const handleTranslateSentence = async () => {
        if (!selectedSentence) return;
        setIsGeneratingSentence(true);
        try {
            // Always translate the whole sentence to native language
            const translation = await generateSentenceMeaning(selectedSentence, firstLanguage);
            setSentenceMeaning(translation || 'Could not translate');
        } catch (error) {
            setSentenceMeaning('Error generating translation');
        } finally {
            setIsGeneratingSentence(false);
        }
    };

    // Collapsed state
    if (isCollapsed) {
        return (
            <div className="w-14 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col items-center py-4 gap-4">
                <button
                    onClick={onToggleCollapse}
                    className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                        <BookOpen size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    {sessionMarkers.length > 0 && (
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            {sessionMarkers.length}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Expanded state
    return (
        <div className="w-96 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Vocabulary Panel</h3>
                </div>
                <button
                    onClick={onToggleCollapse}
                    className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Current Selection Section */}
                {selectedText && selectedSentence ? (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Current Selection</h4>

                            {/* Selected Word */}
                            <div className="mb-3">
                                <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">Selected Word(s):</p>
                                <p className="text-base font-medium text-blue-900 dark:text-blue-100">{selectedText}</p>
                            </div>

                            {/* Sentence with Breakdown */}
                            <div className="mb-3">
                                <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">Sentence:</p>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                    <VocabularyBreakdown
                                        text={selectedSentence}
                                        markedIndices={selectionIndices || []}
                                        onToggleWord={() => { }}
                                        compact={true}
                                    />
                                </div>
                            </div>

                            {/* AI Actions */}
                            <div className="flex gap-2 mb-3">
                                <button
                                    onClick={handleGenerateDefinition}
                                    disabled={isGeneratingWord}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Sparkles size={14} />
                                    {isGeneratingWord ? 'Generating...' : 'Vocabulary define'}
                                </button>
                                <button
                                    onClick={handleTranslateSentence}
                                    disabled={isGeneratingSentence}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Languages size={14} />
                                    {isGeneratingSentence ? 'Translating...' : 'Translate sentence'}
                                </button>
                            </div>

                            {/* Word Definition */}
                            {wordDefinition && (
                                <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">Definition:</p>
                                    {(() => {
                                        try {
                                            // Clean potential markdown json blocks if any
                                            const cleanText = wordDefinition.replace(/```json/g, '').replace(/```/g, '').trim();
                                            const json = JSON.parse(cleanText);
                                            if (json.english || json.native) {
                                                return (
                                                    <div className="space-y-3">
                                                        {json.english && (
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">English</p>
                                                                <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded">{json.english}</p>
                                                            </div>
                                                        )}
                                                        {json.native && (
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Translated</p>
                                                                <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed bg-green-50/50 dark:bg-green-900/10 p-2 rounded">{json.native}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        } catch (e) {
                                            // Fallback
                                        }
                                        return <p className="text-sm text-gray-700 dark:text-gray-300">{wordDefinition}</p>;
                                    })()}
                                </div>
                            )}

                            {/* Sentence Meaning */}
                            {sentenceMeaning && (
                                <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-200 dark:border-indigo-700">
                                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Sentence Meaning:</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{sentenceMeaning}</p>
                                </div>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={onSaveSelection}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <Save size={16} />
                                Save to Markers
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Highlight text to see vocabulary details</p>
                    </div>
                )}

                {/* Saved Markers Section */}
                {sessionMarkers.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Saved Words ({sessionMarkers.length})</h4>
                        </div>

                        <div className="space-y-2">
                            {sessionMarkers.map(marker => {
                                const words = marker.subtitleText?.split(/\s+/) || [];
                                const markedWords = (marker.misunderstoodIndices || []).map(i => words[i]).join(' ');

                                return (
                                    <div
                                        key={marker.id}
                                        className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 flex-1">
                                                {markedWords}
                                            </p>
                                            <button
                                                onClick={() => onRemoveMarker(marker.id)}
                                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                            {marker.subtitleText}
                                        </p>
                                        {marker.vocabData && Object.keys(marker.vocabData).length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                <p className="text-xs text-gray-700 dark:text-gray-300">
                                                    {Object.values(marker.vocabData)[0]?.definition}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
