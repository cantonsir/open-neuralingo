import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Languages, Save, Trash2, Loader2, Volume2 } from 'lucide-react';
import { Marker, VocabData } from '../../types';
import { generateBilingualDefinition, generateSentenceMeaning } from '../../ai';
import VocabularyBreakdown from '../listening/VocabularyBreakdown';

interface ReadingVocabPanelProps {
    selectedText: string | null;
    selectedSentence: string | null;
    selectionIndices: number[] | null;
    selectionKey?: number;
    sessionMarkers: Marker[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onSaveSelection: (data: VocabSavePayload) => void;
    onRemoveMarker: (markerId: string) => void;
    onUpdateVocabData: (markerId: string, index: number, data: VocabData) => void;
    firstLanguage?: string;
    speechLanguage?: string;
}

interface DefinitionData {
    english: string;
    native: string;
    pronunciation?: string;
}

export interface VocabSavePayload {
    word: string;
    sentence: string;
    selectionIndices: number[];
    definition: string;
    translation: string;
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
    firstLanguage = 'en',
    speechLanguage = 'en',
    selectionKey,
}: ReadingVocabPanelProps) {
    const [definition, setDefinition] = useState<DefinitionData | null>(null);
    const [sentenceMeaning, setSentenceMeaning] = useState<string>('');
    const [isLoadingDef, setIsLoadingDef] = useState(false);
    const [isLoadingSentence, setIsLoadingSentence] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastSentenceRef = useRef<string | null>(null);
    const sentenceMeaningCacheRef = useRef<Map<string, string>>(new Map());
    const [localSelectedText, setLocalSelectedText] = useState<string | null>(null);
    const [localSelectionIndices, setLocalSelectionIndices] = useState<number[] | null>(null);

    useEffect(() => {
        if (!selectedText || !selectedSentence) {
            setLocalSelectedText(null);
            setLocalSelectionIndices(null);
            return;
        }

        setLocalSelectedText(selectedText);
        setLocalSelectionIndices(selectionIndices || []);
    }, [selectedText, selectedSentence, selectionIndices, selectionKey]);

    const formatDefinitionForSave = (data: DefinitionData | null): string => {
        if (!data) return '';
        const english = data.english?.trim();
        const native = data.native?.trim();
        if (english && native) return `English: ${english}\nNative: ${native}`;
        return english || native || '';
    };

    const handleSaveSelection = () => {
        if (!localSelectedText || !selectedSentence) return;
        onSaveSelection({
            word: localSelectedText,
            sentence: selectedSentence,
            selectionIndices: localSelectionIndices || [],
            definition: formatDefinitionForSave(definition),
            translation: sentenceMeaning
        });
    };

    const canSave = Boolean(localSelectedText && selectedSentence && !isLoadingDef && !isLoadingSentence);

    const speakSelection = () => {
        if (!localSelectedText) return;
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(localSelectedText);
        const lang = speechLanguage || 'en';
        utterance.lang = lang;

        try {
            const voices = window.speechSynthesis.getVoices();
            const matched = voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
            if (matched) utterance.voice = matched;
        } catch (e) {
            // ignore voice lookup issues
        }

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    };

    // Auto-generate definition when selection changes; sentence meaning only when sentence changes
    useEffect(() => {
        if (!localSelectedText || !selectedSentence) {
            setDefinition(null);
            setSentenceMeaning('');
            setError(null);
            setIsLoadingDef(false);
            setIsLoadingSentence(false);
            lastSentenceRef.current = null;
            return;
        }

        let isCancelled = false;
        const sentenceKey = selectedSentence.trim();
        const sentenceChanged = lastSentenceRef.current !== sentenceKey;
        lastSentenceRef.current = sentenceKey;
        const cachedMeaning = sentenceMeaningCacheRef.current.get(sentenceKey);

        setDefinition(null);
        setError(null);
        setIsLoadingDef(true);
        if (sentenceChanged) {
            if (cachedMeaning) {
                setSentenceMeaning(cachedMeaning);
                setIsLoadingSentence(false);
            } else {
                setSentenceMeaning('');
                setIsLoadingSentence(true);
            }
        } else {
            setIsLoadingSentence(false);
        }

        const loadDefinition = async () => {
            try {
                const result = await generateBilingualDefinition(localSelectedText, selectedSentence, firstLanguage);
                if (!isCancelled && result) {
                    try {
                        const cleanText = result.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(cleanText);
                        setDefinition({
                            english: parsed.english || '',
                            native: parsed.native || '',
                            pronunciation: parsed.pronunciation || ''
                        });
                    } catch {
                        setDefinition({
                            english: result,
                            native: '',
                            pronunciation: ''
                        });
                    }
                }
            } catch (e) {
                if (!isCancelled) {
                    setError('Failed to load definition');
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingDef(false);
                }
            }
        };

        const loadSentenceMeaning = async () => {
            if (!sentenceChanged || cachedMeaning) return;
            try {
                const meaning = await generateSentenceMeaning(selectedSentence, firstLanguage);
                if (!isCancelled) {
                    const value = meaning || '';
                    setSentenceMeaning(value);
                    if (value) {
                        sentenceMeaningCacheRef.current.set(sentenceKey, value);
                    }
                }
            } catch (e) {
                if (!isCancelled) {
                    setSentenceMeaning('');
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingSentence(false);
                }
            }
        };

        loadDefinition();
        loadSentenceMeaning();
        return () => {
            isCancelled = true;
        };
    }, [localSelectedText, selectedSentence, firstLanguage, selectionKey]);

    const handleToggleWord = (index: number) => {
        if (!selectedSentence) return;
        const words = selectedSentence.trim().split(/\s+/).filter(w => w.length > 0);
        const word = words[index];
        if (!word) return;
        setLocalSelectedText(word);
        setLocalSelectionIndices([index]);
    };

    const handleToggleRange = (start: number, end: number) => {
        if (!selectedSentence) return;
        const words = selectedSentence.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return;
        const from = Math.min(start, end);
        const to = Math.max(start, end);
        const indices = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter(i => i >= 0 && i < words.length);
        const phrase = indices.map(i => words[i]).join(' ');
        setLocalSelectedText(phrase);
        setLocalSelectionIndices(indices);
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
                    {localSelectedText && selectedSentence ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Current Selection</h4>

                            {/* Selected Word */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">Selected Word(s):</p>
                                    <button
                                        onClick={speakSelection}
                                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                                        title="Pronounce"
                                    >
                                        <Volume2 size={12} />
                                        Pronounce
                                    </button>
                                </div>
                                <p className="text-base font-medium text-blue-900 dark:text-blue-100">{localSelectedText}</p>
                                {definition?.pronunciation && (
                                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">{definition.pronunciation}</p>
                                )}
                            </div>

                            {/* Sentence with Breakdown */}
                            <div className="mb-3">
                                <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">Sentence:</p>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                    <VocabularyBreakdown
                                        text={selectedSentence}
                                        markedIndices={localSelectionIndices || []}
                                        onToggleWord={handleToggleWord}
                                        onToggleRange={handleToggleRange}
                                        compact={true}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="text-sm text-red-500 mb-2">{error}</div>
                            )}

                            {/* Definition */}
                            <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <BookOpen size={12} />
                                    Definition
                                </div>
                                {isLoadingDef ? (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span className="text-sm">Generating definition...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {definition?.english && (
                                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{definition.english}</p>
                                            </div>
                                        )}
                                        {definition?.native && (
                                            <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{definition.native}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Sentence Meaning */}
                            <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <Languages size={12} />
                                    Sentence Meaning
                                </div>
                                {isLoadingSentence ? (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span className="text-sm">Translating sentence...</span>
                                    </div>
                                ) : sentenceMeaning ? (
                                    <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 italic line-clamp-2">"{selectedSentence}"</p>
                                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{sentenceMeaning}</p>
                                    </div>
                                ) : null}
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSaveSelection}
                                disabled={!canSave}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors"
                            >
                                <Save size={16} />
                                Save to Vocabulary
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
