import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, BookOpen, Languages, Save, Loader2, Sparkles } from 'lucide-react';
import { generateBilingualDefinition, generateSentenceMeaning } from '../../ai';

interface VocabPopupProps {
    word: string;
    sentence: string;
    position: { x: number; y: number };
    onClose: () => void;
    onSave?: (data: { word: string; sentence: string; definition: string; translation: string }) => void;
    firstLanguage: string;
}

interface DefinitionData {
    english: string;
    native: string;
    pronunciation?: string;
}

const VocabPopup = React.forwardRef<HTMLDivElement, VocabPopupProps>(({
    word,
    sentence,
    position,
    onClose,
    onSave,
    firstLanguage
}, forwardedRef) => {
    const popupRef = useRef<HTMLDivElement | null>(null);
    const hasAnimatedRef = useRef(false);
    const [definition, setDefinition] = useState<DefinitionData | null>(null);
    const [sentenceMeaning, setSentenceMeaning] = useState<string>('');
    const [isLoadingDef, setIsLoadingDef] = useState(true);
    const [isLoadingSentence, setIsLoadingSentence] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    const [isVisible, setIsVisible] = useState(false);

    // Adjust position to stay within viewport
    useEffect(() => {
        if (popupRef.current) {
            const popup = popupRef.current;
            const rect = popup.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let newX = position.x;
            let newY = position.y;

            // Horizontal adjustment
            if (newX + rect.width > viewportWidth - 20) {
                newX = viewportWidth - rect.width - 20;
            }
            if (newX < 20) {
                newX = 20;
            }

            // Vertical adjustment - prefer below, but go above if no space
            if (newY + rect.height > viewportHeight - 20) {
                newY = position.y - rect.height - 40; // Above the selection
            }
            if (newY < 20) {
                newY = 20;
            }

            setAdjustedPosition({ x: newX, y: newY });
        }
        
        // Trigger entrance animation only once
        if (!hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(true);
        }
    }, [position]);

    // Load definition and sentence meaning
    useEffect(() => {
        // Reset cached content on new selection
        setDefinition(null);
        setSentenceMeaning('');
        setError(null);
        setIsLoadingDef(true);
        setIsLoadingSentence(true);

        const loadContent = async () => {
            // Generate definition with pronunciation request
            try {
                const result = await generateBilingualDefinition(word, sentence, firstLanguage);
                if (result) {
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
                setError('Failed to load definition');
            } finally {
                setIsLoadingDef(false);
            }

            // Generate sentence meaning
            try {
                const meaning = await generateSentenceMeaning(sentence, firstLanguage);
                setSentenceMeaning(meaning || '');
            } catch (e) {
                setSentenceMeaning('');
            } finally {
                setIsLoadingSentence(false);
            }
        };

        if (word && sentence) {
            loadContent();
        }
    }, [word, sentence, firstLanguage]);

    // Handle click outside and escape key
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 150);
    };

    const handleSave = () => {
        if (onSave) {
            onSave({
                word,
                sentence,
                definition: definition?.english || '',
                translation: sentenceMeaning
            });
        }
        handleClose();
    };

    // Text-to-speech pronunciation
    const speakWord = () => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            window.speechSynthesis.speak(utterance);
        }
    };

    const setRefs = (node: HTMLDivElement | null) => {
        popupRef.current = node;
        if (typeof forwardedRef === 'function') {
            forwardedRef(node);
        } else if (forwardedRef) {
            forwardedRef.current = node;
        }
    };

    return (
        <div
            ref={setRefs}
            className={`fixed z-[9999] w-80 max-w-[calc(100vw-40px)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-opacity duration-150 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
                left: 0,
                top: 0,
                transform: `translate3d(${adjustedPosition.x}px, ${adjustedPosition.y}px, 0)`,
                willChange: 'transform'
            }}
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-white">{word}</span>
                            <button
                                onClick={speakWord}
                                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                                title="Listen to pronunciation"
                            >
                                <Volume2 size={16} className="text-white/80" />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={18} className="text-white/80" />
                    </button>
                </div>
                {definition?.pronunciation && (
                    <p className="text-sm text-white/70 mt-1">{definition.pronunciation}</p>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
                {error ? (
                    <div className="text-center py-4 text-red-500">
                        <p>{error}</p>
                    </div>
                ) : (
                    <>
                        {/* Definition Section */}
                        <div className="space-y-2">
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
                                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                                {definition.english}
                                            </p>
                                        </div>
                                    )}
                                    {definition?.native && (
                                        <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                                {definition.native}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sentence Translation Section */}
                        <div className="space-y-2">
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
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 italic line-clamp-2">
                                        "{sentence}"
                                    </p>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                        {sentenceMeaning}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            {onSave && !isLoadingDef && definition && (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={handleSave}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                        <Save size={14} />
                        Save to Vocabulary
                    </button>
                </div>
            )}
        </div>
    );
});

VocabPopup.displayName = 'VocabPopup';

export default VocabPopup;
