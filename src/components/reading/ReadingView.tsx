import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { View, Marker, VocabData } from '../../types';
import ReadingVocabPanel from './ReadingVocabPanel';

interface ReadingViewProps {
    libraryId: string;
    title: string;
    onNavigate: (view: View) => void;
    onMarkersUpdate?: (markers: Marker[]) => void;
    firstLanguage?: string;
}

export default function ReadingView({ libraryId, title, onNavigate, onMarkersUpdate, firstLanguage = 'en' }: ReadingViewProps) {
    const [content, setContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedText, setSelectedText] = useState<string>('');
    const [selectionRange, setSelectionRange] = useState<{
        paragraphIndex: number;
        sentenceText: string;
        selectedWords: string;
    } | null>(null);
    const [sessionMarkers, setSessionMarkers] = useState<Marker[]>([]);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('readingPanelCollapsed') === 'true';
    });

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await fetch(`/api/library/${libraryId}/content`);
                if (res.ok) {
                    const data = await res.json();
                    setContent(data.content);
                }
            } catch (error) {
                console.error('Failed to fetch content:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (libraryId) {
            fetchContent();
        }
    }, [libraryId]);

    // Extract complete sentence(s) containing the selected text
    const extractSentence = (paragraph: string, selectedText: string): string => {
        // Split into sentences (handle ., !, ?, but avoid abbreviations like "Mr.", "Dr.")
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

        // Find sentence(s) containing the selected text
        const relevantSentences = sentences.filter(s => s.includes(selectedText));

        // Return joined sentences or first sentence if not found
        return relevantSentences.join(' ').trim() || sentences[0];
    };

    // Handle text selection
    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
            setSelectedText('');
            setSelectionRange(null);
            return;
        }

        const text = selection.toString().trim();
        setSelectedText(text);

        // Find which paragraph contains the selection
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const paragraphElement = container.nodeType === Node.TEXT_NODE
            ? container.parentElement?.closest('p')
            : (container as Element).closest('p');

        if (paragraphElement) {
            const paragraphIndex = parseInt(paragraphElement.getAttribute('data-paragraph-index') || '0');
            const fullParagraph = paragraphElement.textContent || '';

            // Extract sentence containing selected text
            const sentenceText = extractSentence(fullParagraph, text);

            setSelectionRange({
                paragraphIndex,
                sentenceText,
                selectedWords: text,
            });
        }
    };

    // Handle saving words to session markers
    const handleSaveWords = () => {
        if (!selectionRange) return;

        const { sentenceText, selectedWords, paragraphIndex } = selectionRange;

        // Create word indices within sentence
        const sentenceWords = sentenceText.split(/\s+/);
        const selectedWordList = selectedWords.split(/\s+/);
        const indices: number[] = [];

        sentenceWords.forEach((word, idx) => {
            if (selectedWordList.some(sw => word.toLowerCase().includes(sw.toLowerCase()))) {
                indices.push(idx);
            }
        });

        const marker: Marker = {
            id: `reading-${Date.now()}-${Math.random()}`,
            start: paragraphIndex,
            end: paragraphIndex,
            subtitleText: sentenceText,
            misunderstoodIndices: indices,
            vocabData: {},
            tags: ['vocabulary'],
            createdAt: Date.now(),
            pressCount: 1,
        };

        const updatedMarkers = [...sessionMarkers, marker];
        setSessionMarkers(updatedMarkers);
        onMarkersUpdate?.(updatedMarkers);
        setSelectedText('');
        setSelectionRange(null);

        // Clear browser selection
        window.getSelection()?.removeAllRanges();
    };

    // Attach text selection listener
    useEffect(() => {
        document.addEventListener('mouseup', handleTextSelection);
        return () => document.removeEventListener('mouseup', handleTextSelection);
    }, [content]);

    // Persist collapse state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('readingPanelCollapsed', String(isPanelCollapsed));
        }
    }, [isPanelCollapsed]);

    // Handler for removing markers
    const handleRemoveMarker = (markerId: string) => {
        const updatedMarkers = sessionMarkers.filter(m => m.id !== markerId);
        setSessionMarkers(updatedMarkers);
        onMarkersUpdate?.(updatedMarkers);
    };

    // Handler for updating vocab data
    const handleUpdateVocabData = (markerId: string, index: number, data: VocabData) => {
        const updatedMarkers = sessionMarkers.map(m => {
            if (m.id === markerId) {
                return {
                    ...m,
                    vocabData: {
                        ...m.vocabData,
                        [index]: data
                    }
                };
            }
            return m;
        });
        setSessionMarkers(updatedMarkers);
        onMarkersUpdate?.(updatedMarkers);
    };

    return (
        <div className="flex-1 flex overflow-hidden bg-white dark:bg-gray-950">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 transition-colors">
                <button
                    onClick={() => onNavigate('library')}
                    className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                        {title}
                    </h2>
                </div>
            </div>

            {/* Content - Scrollable Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-10 lg:p-16">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto">
                            {content ? (
                                <div className="space-y-4 text-base md:text-lg leading-relaxed text-gray-800 dark:text-gray-300">
                                    {content.split('\n').map((paragraph, idx) => {
                                        // Skip empty paragraphs
                                        if (!paragraph.trim()) return null;

                                        return (
                                            <p
                                                key={idx}
                                                data-paragraph-index={idx}
                                                className="whitespace-pre-wrap"
                                            >
                                                {paragraph}
                                            </p>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 italic">No text content available.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
            </div>

            {/* Right Vocabulary Panel */}
            <ReadingVocabPanel
                selectedText={selectedText}
                selectedSentence={selectionRange?.sentenceText || null}
                selectionIndices={selectionRange ? (() => {
                    const sentenceWords = selectionRange.sentenceText.split(/\s+/);
                    const selectedWordList = selectionRange.selectedWords.split(/\s+/);
                    return sentenceWords.map((word, idx) =>
                        selectedWordList.some(sw => word.toLowerCase().includes(sw.toLowerCase())) ? idx : -1
                    ).filter(i => i >= 0);
                })() : null}
                sessionMarkers={sessionMarkers}
                isCollapsed={isPanelCollapsed}
                onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
                onSaveSelection={handleSaveWords}
                onRemoveMarker={handleRemoveMarker}
                onUpdateVocabData={handleUpdateVocabData}
                firstLanguage={firstLanguage}
            />
        </div>
    );
}
