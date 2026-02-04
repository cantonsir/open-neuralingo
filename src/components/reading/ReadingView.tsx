import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, BookOpen, Loader2, Search, ExternalLink, Download } from 'lucide-react';
import { View, Marker, VocabData, LibraryItem, YouTubeSubtitleData } from '../../types';
import ReadingVocabPanel, { VocabSavePayload, FocusSaveItem } from './ReadingVocabPanel';
import { analyzeFocusReadingBehavior, FocusReadingAnalysis, FocusAnnotation, classifyAnnotationType } from './focusReadingAI';
import { generateReadableText } from '../../ai';

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
    const [isFocusModeEnabled, setIsFocusModeEnabled] = useState(false);
    const [focusAnnotations, setFocusAnnotations] = useState<FocusAnnotation[]>([]);
    const [focusAnalysis, setFocusAnalysis] = useState<FocusReadingAnalysis | null>(null);
    const [isAnalyzingFocus, setIsAnalyzingFocus] = useState(false);
    const [isReadableViewEnabled, setIsReadableViewEnabled] = useState(false);
    const [readableContent, setReadableContent] = useState<string | null>(null);
    const [isFormattingReadable, setIsFormattingReadable] = useState(false);
    const readableCacheRef = useRef<Record<string, string>>({});

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
        } else {
            setIsLoading(false);
        }
    }, [libraryId, initialContent]);

    const hashText = (text: string) => {
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
        }
        return hash.toString(16);
    };

    const normalizeReadableText = useCallback((text: string) => text.replace(/\r?\n/g, ''), []);

    const isReadableMatch = useCallback((originalText: string, readableText: string) => {
        return normalizeReadableText(originalText) === normalizeReadableText(readableText);
    }, [normalizeReadableText]);

    const getReadableCacheKey = useCallback(() => {
        const hash = hashText(content);
        if (libraryId) return `library:${libraryId}:${hash}`;
        return `inline:${hash}`;
    }, [libraryId, content]);

    useEffect(() => {
        if (!isReadableViewEnabled || !content) return;

        const cacheKey = getReadableCacheKey();
        const storageKey = `readable:${cacheKey}`;
        const cached = readableCacheRef.current[cacheKey];
        if (cached && isReadableMatch(content, cached)) {
            setReadableContent(cached);
            setIsFormattingReadable(false);
            return;
        }

        if (typeof window !== 'undefined') {
            const stored = window.localStorage.getItem(storageKey);
            if (stored && isReadableMatch(content, stored)) {
                readableCacheRef.current[cacheKey] = stored;
                setReadableContent(stored);
                setIsFormattingReadable(false);
                return;
            }
            if (stored && !isReadableMatch(content, stored)) {
                window.localStorage.removeItem(storageKey);
            }
        }

        let isCancelled = false;
        setIsFormattingReadable(true);
        generateReadableText(content)
            .then((formatted) => {
                if (isCancelled) return;
                if (formatted && formatted.trim() && isReadableMatch(content, formatted)) {
                    readableCacheRef.current[cacheKey] = formatted;
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem(storageKey, formatted);
                    }
                    setReadableContent(formatted);
                } else {
                    setReadableContent(null);
                    setIsReadableViewEnabled(false);
                }
            })
            .catch(() => {
                if (isCancelled) return;
                setReadableContent(null);
                setIsReadableViewEnabled(false);
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsFormattingReadable(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isReadableViewEnabled, content, getReadableCacheKey]);

    // Extract complete sentence(s) containing the selected text
    const extractSentence = (paragraph: string, selectedText: string): string => {
        // Split into sentences (handle ., !, ?, but avoid abbreviations like "Mr.", "Dr.")
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

        // Find sentence(s) containing the selected text
        const relevantSentences = sentences.filter(s => s.includes(selectedText));

        // Return joined sentences or first sentence if not found
        return relevantSentences.join(' ').trim() || sentences[0];
    };

    const buildLineStarts = useCallback((text: string) => {
        const starts = [0];
        for (let i = 0; i < text.length; i += 1) {
            if (text[i] === '\n') {
                starts.push(i + 1);
            }
        }
        return starts;
    }, []);

    const findLineIndex = useCallback((lineStarts: number[], index: number) => {
        let low = 0;
        let high = lineStarts.length - 1;
        let result = 0;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (lineStarts[mid] <= index) {
                result = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return result;
    }, []);

    const originalParagraphs = useMemo(() => content.split('\n'), [content]);

    const readableMaps = useMemo(() => {
        if (!isReadableViewEnabled || !readableContent || !content) return null;
        if (!isReadableMatch(content, readableContent)) return null;

        const readableToOriginal = new Array(readableContent.length).fill(-1);
        const originalToReadable = new Array(content.length).fill(-1);

        const isNewline = (char: string) => char === '\n' || char === '\r';
        let origIndex = 0;

        for (let i = 0; i < readableContent.length; i += 1) {
            const ch = readableContent[i];
            if (isNewline(ch)) continue;

            while (origIndex < content.length && isNewline(content[origIndex])) {
                origIndex += 1;
            }

            if (origIndex >= content.length || content[origIndex] !== ch) {
                return null;
            }

            readableToOriginal[i] = origIndex;
            originalToReadable[origIndex] = i;
            origIndex += 1;
        }

        return {
            readableToOriginal,
            originalToReadable,
            originalLineStarts: buildLineStarts(content),
            readableLineStarts: buildLineStarts(readableContent),
        };
    }, [isReadableViewEnabled, readableContent, content, isReadableMatch, buildLineStarts]);

    const displayAnnotations = useMemo(() => {
        if (!isFocusModeEnabled) return [] as FocusAnnotation[];
        if (!isReadableViewEnabled || !readableMaps || !readableContent) return focusAnnotations;

        const { originalLineStarts, readableLineStarts, originalToReadable } = readableMaps;

        return focusAnnotations
            .map((annotation) => {
                const originalStart = originalLineStarts[annotation.paragraphIndex] + annotation.startOffset;
                const originalEnd = originalLineStarts[annotation.paragraphIndex] + annotation.endOffset;

                const displayStart = originalToReadable[originalStart];
                const displayEnd = originalToReadable[originalEnd - 1];

                if (displayStart === undefined || displayStart < 0 || displayEnd === undefined || displayEnd < 0) {
                    return null;
                }

                const displayEndExclusive = displayEnd + 1;
                const displayParagraphIndex = findLineIndex(readableLineStarts, displayStart);
                const displayParagraphStart = readableLineStarts[displayParagraphIndex] || 0;

                return {
                    ...annotation,
                    paragraphIndex: displayParagraphIndex,
                    startOffset: displayStart - displayParagraphStart,
                    endOffset: displayEndExclusive - displayParagraphStart,
                } as FocusAnnotation;
            })
            .filter((item): item is FocusAnnotation => Boolean(item));
    }, [focusAnnotations, isFocusModeEnabled, isReadableViewEnabled, readableMaps, readableContent, findLineIndex]);

    const getSelectionOffsets = (range: Range, paragraphElement: HTMLElement) => {
        if (!paragraphElement.contains(range.startContainer) || !paragraphElement.contains(range.endContainer)) {
            return null;
        }

        const rawText = range.toString();
        if (!rawText.trim()) return null;

        const preRange = range.cloneRange();
        preRange.selectNodeContents(paragraphElement);
        preRange.setEnd(range.startContainer, range.startOffset);
        const rawStart = preRange.toString().length;
        const leadingWhitespace = rawText.length - rawText.trimStart().length;
        const trailingWhitespace = rawText.length - rawText.trimEnd().length;
        const startOffset = rawStart + leadingWhitespace;
        const endOffset = rawStart + rawText.length - trailingWhitespace;

        return { startOffset, endOffset, trimmedText: rawText.trim() };
    };

    // Handle text selection
    const handleTextSelection = useCallback((event?: MouseEvent) => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
            const target = event?.target as HTMLElement | null;
            if (target && target.closest('[data-vocab-panel]')) {
                return;
            }
            if (!isFocusModeEnabled) {
                setSelectedText('');
                setSelectionRange(null);
            }
            return;
        }

        const range = selection.getRangeAt(0);

        // Find which paragraph contains the selection
        const container = range.commonAncestorContainer;
        const paragraphElement = container.nodeType === Node.TEXT_NODE
            ? container.parentElement?.closest('p')
            : (container as Element).closest('p');

        if (!paragraphElement) return;

        const offsets = getSelectionOffsets(range, paragraphElement);
        if (!offsets) return;

        let { startOffset, endOffset, trimmedText } = offsets;
        if (!trimmedText) return;

        const displayParagraphIndex = parseInt(paragraphElement.getAttribute('data-paragraph-index') || '0');
        let paragraphIndex = displayParagraphIndex;
        let fullParagraph = paragraphElement.textContent || '';

        if (isReadableViewEnabled) {
            if (!readableMaps || !readableContent) return;

            const { readableLineStarts, readableToOriginal, originalLineStarts } = readableMaps;
            const displayParagraphStart = readableLineStarts[displayParagraphIndex] || 0;
            const displayStart = displayParagraphStart + startOffset;
            const displayEnd = displayParagraphStart + endOffset;
            const originalStart = readableToOriginal[displayStart];
            const originalEnd = readableToOriginal[displayEnd - 1];

            if (originalStart === undefined || originalStart < 0 || originalEnd === undefined || originalEnd < 0) {
                return;
            }

            const originalEndExclusive = originalEnd + 1;
            const originalParagraphIndex = findLineIndex(originalLineStarts, originalStart);
            const originalParagraphStart = originalLineStarts[originalParagraphIndex] || 0;

            paragraphIndex = originalParagraphIndex;
            fullParagraph = originalParagraphs[originalParagraphIndex] || '';
            startOffset = originalStart - originalParagraphStart;
            endOffset = originalEndExclusive - originalParagraphStart;
        }

        if (isFocusModeEnabled) {
            // Focus mode: create annotation instead of vocab lookup
            const sentenceContext = extractSentence(fullParagraph, trimmedText);
            const annotationType = classifyAnnotationType(trimmedText, fullParagraph);

            // Check for duplicate — toggle off if already annotated
            const existingIdx = focusAnnotations.findIndex(
                (a) => a.paragraphIndex === paragraphIndex && a.startOffset === startOffset && a.endOffset === endOffset
            );
            if (existingIdx >= 0) {
                setFocusAnnotations((prev) => prev.filter((_, i) => i !== existingIdx));
            } else {
                const annotation: FocusAnnotation = {
                    id: `focus-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    type: annotationType,
                    text: trimmedText,
                    sentenceContext,
                    paragraphIndex,
                    startOffset: Math.max(0, startOffset),
                    endOffset: Math.max(0, endOffset),
                    createdAt: Date.now(),
                };
                setFocusAnnotations((prev) => [...prev, annotation]);
            }
            selection.removeAllRanges();
            return;
        }

        // Normal mode: vocab panel lookup
        const sentenceText = extractSentence(fullParagraph, trimmedText);
        setSelectedText(trimmedText);
        setSelectionRange({
            paragraphIndex,
            sentenceText,
            selectedWords: trimmedText,
        });
        setSelectionKey(prev => prev + 1);
    }, [isFocusModeEnabled, focusAnnotations, isReadableViewEnabled, readableMaps, readableContent, originalParagraphs, findLineIndex]);

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
    }, [handleTextSelection]);

    // Persist collapse state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('readingPanelCollapsed', String(isPanelCollapsed));
        }
    }, [isPanelCollapsed]);

    useEffect(() => {
        if (!isFocusModeEnabled) {
            setFocusAnalysis(null);
        }
    }, [isFocusModeEnabled]);

    // Clear focus annotations when content changes (new article opened)
    useEffect(() => {
        setFocusAnnotations([]);
        setFocusAnalysis(null);
        setIsFocusModeEnabled(false);
        setReadableContent(null);
        setIsReadableViewEnabled(false);
        setIsFormattingReadable(false);
    }, [libraryId]);

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

    const handleRemoveFocusAnnotation = useCallback((id: string) => {
        setFocusAnnotations((prev) => prev.filter((a) => a.id !== id));
    }, []);

    // Render paragraph text with annotation highlights
    const renderAnnotatedParagraph = (paragraphText: string, paragraphIndex: number): React.ReactNode => {
        if (!isFocusModeEnabled || displayAnnotations.length === 0) {
            return paragraphText;
        }

        // Get annotations for this paragraph
        const paragraphAnnotations = displayAnnotations
            .filter((a) => a.paragraphIndex === paragraphIndex)
            .sort((a, b) => a.startOffset - b.startOffset);

        if (paragraphAnnotations.length === 0) {
            return paragraphText;
        }

        const elements: React.ReactNode[] = [];
        let lastIndex = 0;

        paragraphAnnotations.forEach((annotation, idx) => {
            const safeStart = Math.max(0, Math.min(annotation.startOffset, paragraphText.length));
            const safeEnd = Math.max(safeStart, Math.min(annotation.endOffset, paragraphText.length));
            if (safeEnd <= safeStart) {
                return;
            }

            // Add text before this annotation
            if (safeStart > lastIndex) {
                elements.push(
                    <span key={`text-${paragraphIndex}-${idx}`}>
                        {paragraphText.slice(lastIndex, safeStart)}
                    </span>
                );
            }

            // Add the annotated span with appropriate styling
            let className = '';
            if (annotation.type === 'word') {
                className = 'bg-red-200 dark:bg-red-800/40 rounded px-0.5';
            } else if (annotation.type === 'phrase') {
                className = 'bg-green-200 dark:bg-green-800/40 rounded px-0.5';
            } else if (annotation.type === 'sentence') {
                className = 'underline decoration-2 decoration-orange-400 underline-offset-4';
            }

            elements.push(
                <span
                    key={`annotation-${annotation.id}`}
                    className={className}
                    title={`${annotation.type}: ${annotation.text}`}
                >
                    {paragraphText.slice(safeStart, safeEnd)}
                </span>
            );

            lastIndex = safeEnd;
        });

        // Add remaining text after last annotation
        if (lastIndex < paragraphText.length) {
            elements.push(
                <span key={`text-${paragraphIndex}-end`}>
                    {paragraphText.slice(lastIndex)}
                </span>
            );
        }

        return <>{elements}</>;
    };

    const handleFinishFocusReading = async () => {
        if (focusAnnotations.length === 0) return;
        setIsAnalyzingFocus(true);
        try {
            const result = await analyzeFocusReadingBehavior(content, focusAnnotations, firstLanguage);
            setFocusAnalysis(result);
        } catch (error) {
            console.error('Focus reading analysis failed:', error);
        } finally {
            setIsAnalyzingFocus(false);
        }
    };

    const computeFocusIndices = (sentence: string, selected: string) => {
        const sentenceWords = sentence.split(/\s+/);
        const selectedWordList = selected.split(/\s+/);
        return sentenceWords.map((word, idx) =>
            selectedWordList.some(sw => word.toLowerCase().includes(sw.toLowerCase())) ? idx : -1
        ).filter(i => i >= 0);
    };

    const formatFocusDefinition = (item: FocusSaveItem) => {
        const english = item.definitionEnglish?.trim();
        const native = item.definitionNative?.trim();
        if (english && native) return `English: ${english}\nNative: ${native}`;
        return english || native || '';
    };

    // Save a single focus item (word or phrase) to My Words
    const handleSaveFocusItem = useCallback((item: FocusSaveItem) => {
        const formattedDefinition = formatFocusDefinition(item);
        const indices = computeFocusIndices(item.sentenceContext, item.text);
        const mainIndex = indices[0] ?? 0;

        const marker: Marker = {
            id: `focus-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            start: 0,
            end: 0,
            subtitleText: item.sentenceContext,
            misunderstoodIndices: indices.length ? indices : [0],
            vocabData: {
                [mainIndex]: {
                    definition: formattedDefinition || item.text,
                    notes: `${item.type === 'word' ? 'Vocabulary' : 'Phrase'} from Focus Reading`
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
    }, [sessionMarkers, onMarkersUpdate, onSaveToDeck]);

    // Save all focus items (words + phrases) to My Words
    const handleSaveAllFocusItems = useCallback((items: FocusSaveItem[]) => {
        const newMarkers: Marker[] = items.map((item, idx) => {
            const formattedDefinition = formatFocusDefinition(item);
            const indices = computeFocusIndices(item.sentenceContext, item.text);
            const mainIndex = indices[0] ?? 0;
            return {
            id: `focus-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
            start: 0,
            end: 0,
            subtitleText: item.sentenceContext,
            misunderstoodIndices: indices.length ? indices : [0],
            vocabData: {
                [mainIndex]: {
                    definition: formattedDefinition || item.text,
                    notes: `${item.type === 'word' ? 'Vocabulary' : 'Phrase'} from Focus Reading`
                }
            },
            tags: ['vocabulary'],
            createdAt: Date.now() + idx,
            pressCount: 1,
            };
        });

        const updatedMarkers = [...sessionMarkers, ...newMarkers];
        setSessionMarkers(updatedMarkers);
        onMarkersUpdate?.(updatedMarkers);
        newMarkers.forEach(marker => onSaveToDeck?.(marker));
    }, [sessionMarkers, onMarkersUpdate, onSaveToDeck]);

    const displayContent = isReadableViewEnabled && readableContent ? readableContent : content;
    const displayParagraphs = useMemo(() => displayContent.split('\n'), [displayContent]);

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
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                        <span>Readable View</span>
                        <button
                            type="button"
                            onClick={() => setIsReadableViewEnabled((prev) => !prev)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isReadableViewEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'
                            } ${isFormattingReadable ? 'opacity-60 cursor-wait' : ''}`}
                            aria-pressed={isReadableViewEnabled}
                            disabled={isFormattingReadable}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    isReadableViewEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                        {isReadableViewEnabled && isFormattingReadable && (
                            <span className="text-xs text-gray-400">Formatting...</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span>Focus Reading</span>
                        <button
                            type="button"
                            onClick={() => setIsFocusModeEnabled((prev) => !prev)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isFocusModeEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'
                            }`}
                            aria-pressed={isFocusModeEnabled}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    isFocusModeEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
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
                                {displayContent ? (
                                    isReadableViewEnabled && isFormattingReadable && !readableContent ? (
                                        <div className="flex items-center justify-center py-12 text-gray-500">
                                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mr-2" />
                                            <span className="text-sm">Formatting for readability...</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 text-base md:text-lg leading-relaxed text-gray-800 dark:text-gray-300">
                                            {displayParagraphs.map((paragraph, idx) => {
                                                if (!paragraph.trim()) return null;

                                                return (
                                                    <p
                                                        key={idx}
                                                        data-paragraph-index={idx}
                                                        className={`whitespace-pre-wrap ${isFocusModeEnabled ? 'select-text cursor-text' : ''}`}
                                                    >
                                                        {renderAnnotatedParagraph(paragraph, idx)}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center py-16 text-gray-400">
                                        <BookOpen size={48} className="mx-auto mb-4 opacity-40" />
                                        <p className="text-lg font-medium text-gray-500 mb-2">No content loaded</p>
                                        <p className="text-sm">Go to Library to select something to read, or use the Compose tool to generate content.</p>
                                    </div>
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
                focusMode={isFocusModeEnabled ? {
                    enabled: true,
                    annotations: focusAnnotations,
                    analysis: focusAnalysis,
                    isAnalyzing: isAnalyzingFocus,
                    onFinishReading: handleFinishFocusReading,
                    onRemoveAnnotation: handleRemoveFocusAnnotation,
                    onSaveFocusItem: handleSaveFocusItem,
                    onSaveAllFocusItems: handleSaveAllFocusItems,
                } : undefined}
            />
        </div>
    );
}
