import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Loader2, Search, ExternalLink, Download } from 'lucide-react';
import { View, Marker, VocabData, LibraryItem, YouTubeSubtitleData } from '../../types';
import ReadingVocabPanel, { VocabSavePayload } from './ReadingVocabPanel';

// Helper function to parse YouTube content
function parseYouTubeContent(item: LibraryItem): YouTubeSubtitleData | null {
    if (item.file_type !== 'youtube' || !item.content_text) {
        return null;
    }

    try {
        const parsed = JSON.parse(item.content_text);
        if (parsed.metadata && parsed.subtitles) {
            return parsed as YouTubeSubtitleData;
        }
    } catch (e) {
        console.error('Failed to parse YouTube content:', e);
    }

    return null;
}

// YouTube Subtitle View Component
interface YouTubeSubtitleViewProps {
    data: YouTubeSubtitleData;
}

function YouTubeSubtitleView({ data }: YouTubeSubtitleViewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'segmented' | 'continuous'>('segmented');

    const filteredSubtitles = data.subtitles.filter(sub =>
        sub.text.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    const formatSRT = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    const handleExport = () => {
        // Export as SRT format
        const srtContent = filteredSubtitles
            .map((sub, i) => {
                const start = formatSRT(sub.start);
                const end = formatSRT(sub.end);
                return `${i + 1}\n${start} --> ${end}\n${sub.text}\n`;
            })
            .join('\n');

        const blob = new Blob([srtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.metadata.title || 'subtitles'}.srt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header with metadata */}
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-3">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {data.metadata.title}
                    </h1>
                    <a
                        href={data.metadata.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                    >
                        Watch on YouTube
                        <ExternalLink size={14} />
                    </a>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                        📺 {data.metadata.channel}
                    </span>
                    <span className="flex items-center gap-1">
                        ⏱️ {formatDuration(data.metadata.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                        📝 {data.subtitles.length} subtitle segments
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="mb-6 flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search in subtitles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* View toggle */}
                <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('segmented')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewMode === 'segmented'
                                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        Segmented
                    </button>
                    <button
                        onClick={() => setViewMode('continuous')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewMode === 'continuous'
                                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        Continuous
                    </button>
                </div>

                {/* Export button */}
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Download size={16} />
                    Export SRT
                </button>
            </div>

            {/* Search results indicator */}
            {searchQuery && (
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                    Found {filteredSubtitles.length} of {data.subtitles.length} segments
                </div>
            )}

            {/* Subtitle content */}
            {viewMode === 'segmented' ? (
                <div className="space-y-3">
                    {filteredSubtitles.map((subtitle, index) => (
                        <div
                            key={subtitle.id || index}
                            className="flex gap-4 p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                        >
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-mono shrink-0 w-16">
                                {formatTime(subtitle.start)}
                            </span>
                            <p className="text-gray-900 dark:text-white leading-relaxed select-text">
                                {subtitle.text}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="prose prose-lg max-w-none dark:prose-invert bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="leading-relaxed select-text">
                        {filteredSubtitles.map(sub => sub.text).join(' ')}
                    </p>
                </div>
            )}

            {/* Empty state */}
            {filteredSubtitles.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No matching subtitles found' : 'No subtitles available'}
                </div>
            )}
        </div>
    );
}

interface ReadingViewProps {
    libraryId: string;
    title: string;
    content?: string;
    onNavigate: (view: View) => void;
    onMarkersUpdate?: (markers: Marker[]) => void;
    onSaveToDeck?: (marker: Marker) => void;
    firstLanguage?: string;
    speechLanguage?: string;
}

export default function ReadingView({ libraryId, title, content: initialContent, onNavigate, onMarkersUpdate, onSaveToDeck, firstLanguage = 'en', speechLanguage = 'en' }: ReadingViewProps) {
    const [content, setContent] = useState<string>('');
    const [libraryItem, setLibraryItem] = useState<LibraryItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedText, setSelectedText] = useState<string>('');
    const [selectionRange, setSelectionRange] = useState<{
        paragraphIndex: number;
        sentenceText: string;
        selectedWords: string;
    } | null>(null);
    const [selectionKey, setSelectionKey] = useState(0);
    const [sessionMarkers, setSessionMarkers] = useState<Marker[]>([]);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('readingPanelCollapsed') === 'true';
    });

    useEffect(() => {
        if (initialContent !== undefined) {
            setContent(initialContent);
            setLibraryItem(null);
            setIsLoading(false);
            return;
        }

        const fetchContent = async () => {
            try {
                const res = await fetch(`/api/library/${libraryId}/content`);
                if (res.ok) {
                    const data = await res.json();
                    // Store content and check if we need the full item
                    setContent(data.content);

                    // Fetch full library item to check file_type
                    const itemRes = await fetch(`/api/library/library`);
                    if (itemRes.ok) {
                        const items = await itemRes.json();
                        const item = items.find((i: LibraryItem) => i.id === libraryId);
                        if (item) {
                            setLibraryItem({
                                ...item,
                                content_text: data.content
                            });
                        }
                    }
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
    }, [libraryId, initialContent]);

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
    const handleTextSelection = (event?: MouseEvent) => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
            const target = event?.target as HTMLElement | null;
            if (target && target.closest('[data-vocab-panel]')) {
                return;
            }
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
            setSelectionKey(prev => prev + 1);
        }
    };

    // Handle saving words to session markers
    const handleSaveWords = (data: VocabSavePayload) => {
        if (!selectionRange) return;

        const sentenceText = data.sentence || selectionRange.sentenceText;
        const paragraphIndex = selectionRange.paragraphIndex;
        const indices = data.selectionIndices && data.selectionIndices.length > 0 ? data.selectionIndices : [0];
        const mainIndex = indices[0] ?? 0;
        const definitionText = data.definition || data.word;

        const marker: Marker = {
            id: `reading-${Date.now()}-${Math.random()}`,
            start: paragraphIndex,
            end: paragraphIndex,
            subtitleText: sentenceText,
            misunderstoodIndices: indices,
            vocabData: {
                [mainIndex]: {
                    definition: definitionText,
                    notes: data.translation || ''
                }
            },
            tags: ['vocabulary'],
            createdAt: Date.now(),
            pressCount: 1,
        };

        const updatedMarkers = [...sessionMarkers, marker];
        setSessionMarkers(updatedMarkers);
        onMarkersUpdate?.(updatedMarkers);
        onSaveToDeck?.(marker);
        setSelectedText('');
        setSelectionRange(null);
        setSelectionKey(prev => prev + 1);

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
                    ) : (() => {
                        // Check if this is YouTube content
                        const youtubeData = libraryItem ? parseYouTubeContent(libraryItem) : null;

                        if (youtubeData) {
                            // Render YouTube subtitle view
                            return <YouTubeSubtitleView data={youtubeData} />;
                        }

                        // Render regular article content
                        return (
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
                        );
                    })()}
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
                selectionKey={selectionKey}
                sessionMarkers={sessionMarkers}
                isCollapsed={isPanelCollapsed}
                onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
                onSaveSelection={handleSaveWords}
                onRemoveMarker={handleRemoveMarker}
                onUpdateVocabData={handleUpdateVocabData}
                firstLanguage={firstLanguage}
                speechLanguage={speechLanguage}
            />
        </div>
    );
}
