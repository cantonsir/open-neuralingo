import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Languages, Save, Trash2, Loader2, Volume2, Check, Plus } from 'lucide-react';
import { Marker, VocabData } from '../../types';
import { generateBilingualDefinition, generateSentenceMeaning } from '../../ai';
import VocabularyBreakdown from '../listening/VocabularyBreakdown';
import { FocusReadingAnalysis, FocusAnnotation } from './focusReadingAI';

export interface FocusSaveItem {
    type: 'word' | 'phrase';
    text: string;
    sentenceContext: string;
    definitionEnglish?: string;
    definitionNative?: string;
    pronunciation?: string;
}

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
    focusMode?: {
        enabled: boolean;
        annotations: FocusAnnotation[];
        analysis: FocusReadingAnalysis | null;
        isAnalyzing: boolean;
        onFinishReading: () => void;
        onRemoveAnnotation: (id: string) => void;
        onSaveFocusItem?: (item: FocusSaveItem) => void;
        onSaveAllFocusItems?: (items: FocusSaveItem[]) => void;
    };
}

interface DefinitionData {
    english: string;
    native: string;
    pronunciation?: string;
}

const buildFallbackDefinition = (selected: string, sentence: string): DefinitionData => {
    const snippet = sentence.length > 160 ? `${sentence.slice(0, 157)}...` : sentence;
    return {
        english: `"${selected}" appears in this context: ${snippet}`,
        native: '',
        pronunciation: ''
    };
};

const buildFallbackSentenceMeaning = (sentence: string): string => {
    return sentence;
};

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
    focusMode,
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
    const isFocusEnabled = Boolean(focusMode?.enabled);
    const [activeTab, setActiveTab] = useState<'vocab' | 'assessment'>(isFocusEnabled ? 'assessment' : 'vocab');
    const [savedFocusItems, setSavedFocusItems] = useState<Set<string>>(new Set());

    // Reset saved items when analysis changes
    useEffect(() => {
        setSavedFocusItems(new Set());
    }, [focusMode?.analysis]);

    useEffect(() => {
        if (isFocusEnabled) {
            setActiveTab('assessment');
        } else {
            setActiveTab('vocab');
        }
    }, [isFocusEnabled]);

    const getSentenceWords = () => selectedSentence ? selectedSentence.trim().split(/\s+/).filter(w => w.length > 0) : [];

    const cleanToken = (token: string) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

    const buildCleanPhrase = (words: string[], indices: number[]) => {
        return indices.map(i => cleanToken(words[i] || '')).filter(Boolean).join(' ');
    };

    const normalizeIndices = (indices: number[], wordCount: number) => {
        if (!indices.length) return [];
        const sorted = [...indices].sort((a, b) => a - b).filter(i => i >= 0 && i < wordCount);
        if (sorted.length <= 1) return sorted;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    };

    const buildPhrase = (words: string[], indices: number[]) => indices.map(i => words[i]).join(' ');

    useEffect(() => {
        if (!selectedText || !selectedSentence) {
            setLocalSelectedText(null);
            setLocalSelectionIndices(null);
            return;
        }

        const words = getSentenceWords();
        const normalized = normalizeIndices(selectionIndices || [], words.length);
        const cleanedSelected = selectedText.split(/\s+/).map(cleanToken).filter(Boolean).join(' ');
        const nextText = normalized.length > 0 ? buildCleanPhrase(words, normalized) : cleanedSelected;

        setLocalSelectedText(nextText);
        setLocalSelectionIndices(normalized);
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
                if (isCancelled) return;

                if (result) {
                    try {
                        const cleanText = result.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(cleanText);
                        const parsedDefinition = {
                            english: parsed.english || '',
                            native: parsed.native || '',
                            pronunciation: parsed.pronunciation || ''
                        };

                        if (parsedDefinition.english || parsedDefinition.native) {
                            setDefinition(parsedDefinition);
                        } else {
                            setDefinition(buildFallbackDefinition(localSelectedText, selectedSentence));
                        }
                    } catch {
                        setDefinition({
                            english: result,
                            native: '',
                            pronunciation: ''
                        });
                    }
                } else {
                    setDefinition(buildFallbackDefinition(localSelectedText, selectedSentence));
                }
            } catch (e) {
                if (!isCancelled) {
                    setError('AI definition unavailable. Showing context fallback.');
                    setDefinition(buildFallbackDefinition(localSelectedText, selectedSentence));
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
                    const value = meaning || buildFallbackSentenceMeaning(selectedSentence);
                    setSentenceMeaning(value);
                    if (value) {
                        sentenceMeaningCacheRef.current.set(sentenceKey, value);
                    }
                }
            } catch (e) {
                if (!isCancelled) {
                    setSentenceMeaning(buildFallbackSentenceMeaning(selectedSentence));
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
        const words = getSentenceWords();
        const word = words[index];
        if (!word) return;

        const current = localSelectionIndices || [];
        if (current.length > 0) {
            const sorted = [...current].sort((a, b) => a - b);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];

            if (index >= min && index <= max) {
                setLocalSelectedText(word);
                setLocalSelectionIndices([index]);
                return;
            }

            if (index === min - 1 || index === max + 1) {
                const range = Array.from({ length: (index < min ? max - index + 1 : index - min + 1) }, (_, i) => (index < min ? index + i : min + i));
                const phrase = buildCleanPhrase(words, range);
                setLocalSelectedText(phrase);
                setLocalSelectionIndices(range);
                return;
            }
        }

        setLocalSelectedText(cleanToken(word));
        setLocalSelectionIndices([index]);
    };

    const handleToggleRange = (start: number, end: number) => {
        if (!selectedSentence) return;
        const words = getSentenceWords();
        if (words.length === 0) return;
        const from = Math.min(start, end);
        const to = Math.max(start, end);
        const indices = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter(i => i >= 0 && i < words.length);
        const phrase = buildCleanPhrase(words, indices);
        setLocalSelectedText(phrase);
        setLocalSelectionIndices(indices);
    };

    // Collapsed state
    if (isCollapsed) {
        return (
            <div
                data-vocab-panel
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className="w-14 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col items-center py-4 gap-4"
            >
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

    const renderAssessmentContent = (): React.ReactNode => {
        if (!focusMode) return null;

        if (focusMode.isAnalyzing) {
            return (
                <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Analyzing focus reading...</span>
                </div>
            );
        }

        // Before analysis: show annotations list and finish button
        if (!focusMode.analysis) {
            const annotations = focusMode.annotations;
            const wordCount = annotations.filter((a) => a.type === 'word').length;
            const phraseCount = annotations.filter((a) => a.type === 'phrase').length;
            const sentenceCount = annotations.filter((a) => a.type === 'sentence').length;

            return (
                <div className="space-y-4">
                    <div className="rounded-xl border border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
                        <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-2">Focus Reading</h4>
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-1">
                            Select text to mark what you don't understand:
                        </p>
                        <ul className="text-xs text-indigo-600 dark:text-indigo-300 space-y-0.5 ml-2">
                            <li><span className="inline-block w-3 h-3 bg-red-200 dark:bg-red-800/40 rounded mr-1"></span> 1 word = vocabulary gap</li>
                            <li><span className="inline-block w-3 h-3 bg-green-200 dark:bg-green-800/40 rounded mr-1"></span> 2+ words = phrase gap</li>
                            <li><span className="inline-block w-3 h-2 border-b-2 border-orange-400 mr-1"></span> Full sentence = comprehension gap</li>
                        </ul>
                    </div>

                    {annotations.length > 0 && (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Annotations ({annotations.length})</p>
                            <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">{wordCount} words</span>
                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">{phraseCount} phrases</span>
                                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 rounded">{sentenceCount} sentences</span>
                            </div>
                        </div>
                    )}

                    {/* Annotation list grouped by type */}
                    {wordCount > 0 && (
                        <div className="space-y-1">
                            <h5 className="text-xs font-semibold text-red-700 dark:text-red-400">Words</h5>
                            <div className="space-y-1">
                                {annotations.filter((a) => a.type === 'word').map((a) => (
                                    <div key={a.id} className="flex items-center justify-between p-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                                        <span className="text-sm text-gray-800 dark:text-gray-200">{a.text}</span>
                                        <button
                                            onClick={() => focusMode.onRemoveAnnotation(a.id)}
                                            className="p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {phraseCount > 0 && (
                        <div className="space-y-1">
                            <h5 className="text-xs font-semibold text-green-700 dark:text-green-400">Phrases</h5>
                            <div className="space-y-1">
                                {annotations.filter((a) => a.type === 'phrase').map((a) => (
                                    <div key={a.id} className="flex items-center justify-between p-1.5 rounded bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                                        <span className="text-sm text-gray-800 dark:text-gray-200">{a.text}</span>
                                        <button
                                            onClick={() => focusMode.onRemoveAnnotation(a.id)}
                                            className="p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sentenceCount > 0 && (
                        <div className="space-y-1">
                            <h5 className="text-xs font-semibold text-orange-700 dark:text-orange-400">Sentences</h5>
                            <div className="space-y-1">
                                {annotations.filter((a) => a.type === 'sentence').map((a) => (
                                    <div key={a.id} className="flex items-start justify-between p-1.5 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
                                        <span className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2">{a.text}</span>
                                        <button
                                            onClick={() => focusMode.onRemoveAnnotation(a.id)}
                                            className="p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 shrink-0"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={focusMode.onFinishReading}
                        disabled={annotations.length === 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                        Finish Reading
                    </button>
                </div>
            );
        }

        // After analysis: show results
        const analysis = focusMode.analysis;
        const stats = analysis.statistics;
        const annotations = focusMode.annotations;

        // Helper to find sentence context from annotations
        const findSentenceContext = (text: string, type: 'word' | 'phrase'): string => {
            const annotation = annotations.find(a => a.text.toLowerCase() === text.toLowerCase() && a.type === type);
            return annotation?.sentenceContext || text;
        };

        const hasDefinition = (definition?: { english?: string; native?: string }) => {
            return Boolean(definition?.english || definition?.native);
        };

        // Build saveable items for Save All
        const getSaveableItems = (): FocusSaveItem[] => {
            const items: FocusSaveItem[] = [];
            analysis.flaggedWords.forEach(word => {
                const key = `word-${word.word}`;
                if (!savedFocusItems.has(key) && hasDefinition(word.definition)) {
                    items.push({
                        type: 'word',
                        text: word.word,
                        sentenceContext: findSentenceContext(word.word, 'word'),
                        definitionEnglish: word.definition?.english,
                        definitionNative: word.definition?.native,
                        pronunciation: word.definition?.pronunciation,
                    });
                }
            });
            analysis.flaggedPhrases.forEach(phrase => {
                const key = `phrase-${phrase.phrase}`;
                if (!savedFocusItems.has(key) && hasDefinition(phrase.definition)) {
                    items.push({
                        type: 'phrase',
                        text: phrase.phrase,
                        sentenceContext: findSentenceContext(phrase.phrase, 'phrase'),
                        definitionEnglish: phrase.definition?.english,
                        definitionNative: phrase.definition?.native,
                    });
                }
            });
            return items;
        };

        const handleSaveItem = (
            type: 'word' | 'phrase',
            text: string,
            definition?: { english?: string; native?: string; pronunciation?: string }
        ) => {
            const key = `${type}-${text}`;
            if (savedFocusItems.has(key)) return;
            
            const sentenceContext = findSentenceContext(text, type);
            const item: FocusSaveItem = {
                type,
                text,
                sentenceContext,
                definitionEnglish: definition?.english,
                definitionNative: definition?.native,
                pronunciation: definition?.pronunciation,
            };
            
            focusMode.onSaveFocusItem?.(item);
            setSavedFocusItems(prev => new Set(prev).add(key));
        };

        const handleSaveAll = () => {
            const items = getSaveableItems();
            if (items.length === 0) return;
            
            focusMode.onSaveAllFocusItems?.(items);
            
            // Mark all as saved
            const newSaved = new Set(savedFocusItems);
            items.forEach(item => newSaved.add(`${item.type}-${item.text}`));
            setSavedFocusItems(newSaved);
        };

        const saveableCount = getSaveableItems().length;
        const hasSaveHandlers = focusMode.onSaveFocusItem || focusMode.onSaveAllFocusItems;

        const formatDefinitionBlock = (definition?: { english?: string; native?: string }) => {
            if (!definition?.english && !definition?.native) return null;

            return (
                <div className="space-y-2">
                    {definition.english && (
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{definition.english}</p>
                        </div>
                    )}
                    {definition.native && (
                        <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{definition.native}</p>
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div className="space-y-4">
                <div className="rounded-xl border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">Summary</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-100 leading-relaxed">{analysis.summary}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                        <p className="text-xs text-gray-500">Overall</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{analysis.overallLevel}/5</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                        <p className="text-xs text-gray-500">Vocab</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{analysis.vocabularyLevel}/5</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                        <p className="text-xs text-gray-500">Grammar</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{analysis.grammarLevel}/5</p>
                    </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Annotation Stats</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                        <p>Words flagged: {stats.wordAnnotations}</p>
                        <p>Phrases flagged: {stats.phraseAnnotations}</p>
                        <p>Sentences flagged: {stats.sentenceAnnotations}</p>
                        <p className="font-medium">Primary barrier: {analysis.primaryBarrier}</p>
                    </div>
                </div>

                {/* Save All Button */}
                {hasSaveHandlers && saveableCount > 0 && (
                    <button
                        onClick={handleSaveAll}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Save size={16} />
                        Save All to My Words ({saveableCount})
                    </button>
                )}

                {analysis.flaggedWords.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vocabulary Definitions</h4>
                        <div className="space-y-3">
                            {analysis.flaggedWords.map((word, idx) => {
                                const key = `word-${word.word}`;
                                const isSaved = savedFocusItems.has(key);
                                const canSave = hasSaveHandlers && hasDefinition(word.definition) && !isSaved;
                                const definitionBlock = formatDefinitionBlock(word.definition);

                                return (
                                    <div key={`${word.word}-${idx}`} className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-blue-700 dark:text-blue-400 uppercase tracking-wide">Word</p>
                                                <p className="text-base font-semibold text-blue-900 dark:text-blue-100">{word.word}</p>
                                                {word.definition?.pronunciation && (
                                                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">{word.definition.pronunciation}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 capitalize">{word.difficulty}</span>
                                                {canSave && (
                                                    <button
                                                        onClick={() => handleSaveItem('word', word.word, word.definition)}
                                                        className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                                                        title="Save to My Words"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                )}
                                                {isSaved && (
                                                    <span className="p-1 text-green-600 dark:text-green-400">
                                                        <Check size={14} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {definitionBlock && (
                                            <div className="mt-3 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    <BookOpen size={12} />
                                                    Definition
                                                </div>
                                                {definitionBlock}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {analysis.flaggedPhrases.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Phrase Explanations</h4>
                        <div className="space-y-3">
                            {analysis.flaggedPhrases.map((phrase, idx) => {
                                const key = `phrase-${phrase.phrase}`;
                                const isSaved = savedFocusItems.has(key);
                                const canSave = hasSaveHandlers && hasDefinition(phrase.definition) && !isSaved;
                                const definitionBlock = formatDefinitionBlock(phrase.definition);

                                return (
                                    <div key={`${phrase.phrase}-${idx}`} className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-blue-700 dark:text-blue-400 uppercase tracking-wide">Phrase</p>
                                                <p className="text-base font-semibold text-blue-900 dark:text-blue-100">"{phrase.phrase}"</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {canSave && (
                                                    <button
                                                        onClick={() => handleSaveItem('phrase', phrase.phrase, phrase.definition)}
                                                        className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                                                        title="Save to My Words"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                )}
                                                {isSaved && (
                                                    <span className="p-1 text-green-600 dark:text-green-400">
                                                        <Check size={14} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {definitionBlock && (
                                            <div className="mt-3 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    <BookOpen size={12} />
                                                    Explanation
                                                </div>
                                                {definitionBlock}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {analysis.flaggedSentences.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sentence Analysis</h4>
                        <div className="space-y-2">
                            {analysis.flaggedSentences.map((sentence, idx) => (
                                <div key={`sent-${idx}`} className="p-2 rounded-lg border border-orange-100 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
                                    <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2">"{sentence.text}"</p>
                                    {sentence.grammarPattern && (
                                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Pattern: {sentence.grammarPattern}</p>
                                    )}
                                    {sentence.explanation && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{sentence.explanation}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {analysis.strengths.length > 0 && (
                    <div className="rounded-lg border border-green-100 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">Strengths</p>
                        <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                            {analysis.strengths.map((strength, idx) => (
                                <li key={`${strength}-${idx}`}>{strength}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {analysis.weaknesses.length > 0 && (
                    <div className="rounded-lg border border-orange-100 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-3">
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-2">Areas to Improve</p>
                        <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                            {analysis.weaknesses.map((weakness, idx) => (
                                <li key={`${weakness}-${idx}`}>{weakness}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="rounded-lg border border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-3">
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Recommendations</p>
                    <div className="text-sm text-indigo-800 dark:text-indigo-200 space-y-1">
                        {analysis.recommendations.focusAreas.map((item, idx) => (
                            <p key={`focus-${idx}`}>- {item}</p>
                        ))}
                        {analysis.recommendations.nextSteps.map((item, idx) => (
                            <p key={`next-${idx}`}>- {item}</p>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // Expanded state
    return (
        <div
            data-vocab-panel
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="w-96 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Reading Panel</h3>
                </div>
                {isFocusEnabled && (
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab('vocab')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                activeTab === 'vocab'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            Vocab
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('assessment')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                activeTab === 'assessment'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            Assessment
                        </button>
                    </div>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {isFocusEnabled && activeTab === 'assessment' ? (
                    renderAssessmentContent()
                ) : (
                    <>
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
                    </>
                )}
            </div>
        </div>
    );
}
