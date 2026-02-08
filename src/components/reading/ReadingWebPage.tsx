import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, RotateCw, Globe, FileText, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { View, Marker, VocabData } from '../../types';
import ReadingVocabPanel, { VocabSavePayload } from './ReadingVocabPanel';

interface ReadingWebPageProps {
    onNavigate: (view: View) => void;
    firstLanguage?: string;
    onMarkersUpdate?: (markers: Marker[]) => void;
    onSaveToDeck?: (marker: Marker) => void;
    speechLanguage?: string;
}

interface ReaderContent {
    title: string;
    content: string;
    author?: string;
    date?: string;
    image?: string;
}

export default function ReadingWebPage({ 
    onNavigate, 
    firstLanguage = 'zh-CN',
    onMarkersUpdate,
    onSaveToDeck,
    speechLanguage = 'en'
}: ReadingWebPageProps) {
    const [url, setUrl] = useState('https://en.wikipedia.org/wiki/Special:Random');
    const [currentSrc, setCurrentSrc] = useState(`/api/proxy?url=${encodeURIComponent('https://en.wikipedia.org/wiki/Special:Random')}`);
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<'full' | 'reader'>('full');
    const [readerContent, setReaderContent] = useState<ReaderContent | null>(null);
    const [readerError, setReaderError] = useState<string | null>(null);

    // Navigation history state
    const [navigationHistory, setNavigationHistory] = useState<string[]>(['https://en.wikipedia.org/wiki/Special:Random']);
    const [historyIndex, setHistoryIndex] = useState(0);
    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < navigationHistory.length - 1;
    
    // Vocabulary panel state
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
    const [selectionIndices, setSelectionIndices] = useState<number[] | null>(null);
    const [selectionKey, setSelectionKey] = useState(0);
    const [sessionMarkers, setSessionMarkers] = useState<Marker[]>([]);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('readingWebPanelCollapsed') === 'true';
    });

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const readerContentRef = useRef<HTMLDivElement>(null);

    // Extract sentence containing the selected word, using character offset when available
    const extractSentence = (text: string, selectedWord: string, charOffset?: number): string => {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

        // If we have a character offset, find the specific sentence at that position
        if (charOffset !== undefined) {
            let searchFrom = 0;
            for (const sentence of sentences) {
                const idx = text.indexOf(sentence, searchFrom);
                if (idx === -1) { searchFrom += sentence.length; continue; }
                const sentenceEnd = idx + sentence.length;
                if (charOffset >= idx && charOffset < sentenceEnd) {
                    return sentence.trim();
                }
                searchFrom = sentenceEnd;
            }
        }

        // Fallback: find first sentence containing the word
        const relevantSentence = sentences.find(s => 
            s.toLowerCase().includes(selectedWord.toLowerCase())
        );
        return relevantSentence?.trim() || text.slice(0, 200);
    };

    const computeSelectionIndices = (sentence: string, selected: string): number[] => {
        const sentenceWords = sentence.split(/\s+/);
        const selectedWordList = selected.split(/\s+/);
        const clean = (w: string) => w.toLowerCase().replace(/[.,!?;:'"()]/g, '');
        // Find the first contiguous run of words matching the selection
        for (let i = 0; i <= sentenceWords.length - selectedWordList.length; i++) {
            const match = selectedWordList.every((sw, j) =>
                clean(sentenceWords[i + j]) === clean(sw)
            );
            if (match) {
                return Array.from({ length: selectedWordList.length }, (_, j) => i + j);
            }
        }
        // Fallback: find first occurrence of each word individually
        const result: number[] = [];
        for (const sw of selectedWordList) {
            const idx = sentenceWords.findIndex((w, i) =>
                !result.includes(i) && clean(w) === clean(sw)
            );
            if (idx >= 0) result.push(idx);
        }
        return result.sort((a, b) => a - b);
    };

    const handleReaderSelection = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
            return;
        }

        const text = selection.toString().trim();
        
        // Only process short selections (max 12 words)
        const wordCount = text.split(/\s+/).length;
        if (wordCount > 12 || text.length > 200) {
            return;
        }

        // Find the surrounding text for context
        let contextText = '';
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
            contextText = container.textContent || '';
        } else if (container instanceof Element) {
            contextText = container.textContent || '';
        }
        
        // Get the parent paragraph for better context
        const paragraphElement = container.nodeType === Node.TEXT_NODE
            ? container.parentElement?.closest('p, div, article')
            : (container as Element).closest('p, div, article');
        
        if (paragraphElement) {
            contextText = paragraphElement.textContent || contextText;
        }

        // Compute offset of selection within the context text
        let selectionOffset: number | undefined;
        if (paragraphElement) {
            const preRange = range.cloneRange();
            preRange.selectNodeContents(paragraphElement);
            preRange.setEnd(range.startContainer, range.startOffset);
            selectionOffset = preRange.toString().length;
        }

        const sentence = extractSentence(contextText, text, selectionOffset);
        // Vocab panel lookup
        const indices = computeSelectionIndices(sentence, text);
        setSelectedText(text);
        setSelectedSentence(sentence);
        setSelectionIndices(indices);
        setSelectionKey(prev => prev + 1);

        // Clear selection after showing popup
        // selection.removeAllRanges();
    }, []);

    // Listen for messages from iframe (Full Page Mode)
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'vocab-selection') {
                const { word, sentence } = event.data;
                if (!word || !sentence) return;
                const indices = computeSelectionIndices(sentence, word);
                setSelectedText(word);
                setSelectedSentence(sentence);
                setSelectionIndices(indices);
                setSelectionKey(prev => prev + 1);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Add selection listener for Reader Mode
    useEffect(() => {
        if (mode === 'reader') {
            const handleMouseUp = (e: MouseEvent) => {
                // Small delay to ensure selection is complete
                setTimeout(handleReaderSelection, 10);
            };
            
            document.addEventListener('mouseup', handleMouseUp);
            return () => document.removeEventListener('mouseup', handleMouseUp);
        }
    }, [mode, handleReaderSelection]);

    // Clear selection when switching modes
    useEffect(() => {
        setSelectedText(null);
        setSelectedSentence(null);
        setSelectionIndices(null);
    }, [mode]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('readingWebPanelCollapsed', String(isPanelCollapsed));
        }
    }, [isPanelCollapsed]);

    // Save vocabulary to session markers + deck
    const handleSaveVocab = (data: VocabSavePayload) => {
        const indices = data.selectionIndices && data.selectionIndices.length > 0 ? data.selectionIndices : [0];
        const mainIndex = indices[0] ?? 0;
        const definitionText = data.definition || data.word;

        const marker: Marker = {
            id: `webpage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            start: 0,
            end: 0,
            subtitleText: data.sentence,
            misunderstoodIndices: indices,
            vocabData: {
                [mainIndex]: {
                    definition: definitionText,
                    notes: data.translation
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
    };

    const handleRemoveMarker = (markerId: string) => {
        const updatedMarkers = sessionMarkers.filter(m => m.id !== markerId);
        setSessionMarkers(updatedMarkers);
        onMarkersUpdate?.(updatedMarkers);
    };

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

    const clearSelection = () => {
        setSelectedText(null);
        setSelectedSentence(null);
        setSelectionIndices(null);
        setSelectionKey(prev => prev + 1);
    };

    const handleGo = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        let target = url.trim();
        if (!target) return;

        if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
        }

        // Add to navigation history (remove forward history)
        const newHistory = navigationHistory.slice(0, historyIndex + 1);
        newHistory.push(target);
        setNavigationHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        setUrl(target);
        setIsLoading(true);
        setReaderError(null);
        clearSelection();

        if (mode === 'full') {
            setCurrentSrc(`/api/proxy?url=${encodeURIComponent(target)}`);
        } else {
            await fetchReaderContent(target);
        }
    };

    const fetchReaderContent = async (targetUrl: string) => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/proxy/reader?url=${encodeURIComponent(targetUrl)}`);
            
            if (!response.ok) {
                throw new Error('Failed to extract article content');
            }
            
            const data = await response.json();
            setReaderContent(data);
            setReaderError(null);
        } catch (error) {
            setReaderError(error instanceof Error ? error.message : 'Failed to load content');
            setReaderContent(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModeChange = async (newMode: 'full' | 'reader') => {
        setMode(newMode);
        setIsLoading(true);
        clearSelection();
        
        let target = url.trim();
        if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
        }
        
        if (newMode === 'full') {
            setCurrentSrc(`/api/proxy?url=${encodeURIComponent(target)}`);
        } else {
            await fetchReaderContent(target);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleGo();
        }
    };

    const handleNavigateBack = () => {
        if (!canGoBack) return;
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const targetUrl = navigationHistory[newIndex];
        setUrl(targetUrl);

        // Load without adding to history
        setIsLoading(true);
        setReaderError(null);
        clearSelection();

        if (mode === 'full') {
            setCurrentSrc(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
        } else {
            fetchReaderContent(targetUrl);
        }
    };

    const handleNavigateForward = () => {
        if (!canGoForward) return;
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        const targetUrl = navigationHistory[newIndex];
        setUrl(targetUrl);

        setIsLoading(true);
        setReaderError(null);
        clearSelection();

        if (mode === 'full') {
            setCurrentSrc(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
        } else {
            fetchReaderContent(targetUrl);
        }
    };

    const handleReload = () => {
        setIsLoading(true);
        clearSelection();
        if (mode === 'full') {
            const baseUrl = currentSrc.split('&_t=')[0];
            setCurrentSrc(`${baseUrl}&_t=${Date.now()}`);
        } else {
            let target = url.trim();
            if (!target.startsWith('http://') && !target.startsWith('https://')) {
                target = 'https://' + target;
            }
            fetchReaderContent(target);
        }
    };

    return (
        <div className="flex h-full bg-gray-50 dark:bg-gray-950 relative">
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                {/* Single Compact Row */}
                <div className="flex items-center justify-between gap-2 px-4 py-2">
                    {/* Left: Globe + Navigation */}
                    <div className="flex items-center gap-2">
                        <Globe size={18} className="text-indigo-500" />

                        {/* Back/Forward Navigation */}
                        <div className="flex items-center gap-0.5 border-l border-gray-200 dark:border-gray-700 pl-2">
                            <button
                                onClick={handleNavigateBack}
                                disabled={!canGoBack}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    canGoBack
                                        ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                        : 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                                }`}
                                title="Go back"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={handleNavigateForward}
                                disabled={!canGoForward}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    canGoForward
                                        ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                        : 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                                }`}
                                title="Go forward"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Center: URL Bar */}
                    <form onSubmit={handleGo} className="flex-1 max-w-2xl">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <Search size={14} className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter URL..."
                                className="block w-full pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </form>

                    {/* Right: Reload + Mode Toggle + Focus Reading + Saved Words */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleReload}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Reload"
                        >
                            <RotateCw size={16} className="text-gray-600 dark:text-gray-400" />
                        </button>

                        {/* Compact Mode Toggle */}
                        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                            <button
                                onClick={() => handleModeChange('full')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                    mode === 'full'
                                        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400'
                                }`}
                                title="Full Page Mode"
                            >
                                Full
                            </button>
                            <button
                                onClick={() => handleModeChange('reader')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                    mode === 'reader'
                                        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400'
                                }`}
                                title="Reader Mode"
                            >
                                Reader
                            </button>
                        </div>

                        {sessionMarkers.length > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium">
                                <BookOpen size={12} />
                                {sessionMarkers.length}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative bg-white dark:bg-gray-900 overflow-hidden">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950 z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                )}

                {mode === 'full' ? (
                    /* Full Page Mode - iframe */
                    <iframe
                        ref={iframeRef}
                        src={currentSrc}
                        className="w-full h-full border-none"
                        onLoad={() => setIsLoading(false)}
                        onError={() => setIsLoading(false)}
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        title="Embedded Browser"
                    />
                ) : (
                    /* Reader Mode - extracted content */
                    <div ref={readerContentRef} className="h-full overflow-y-auto">
                        {readerError ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                                    <FileText size={32} className="text-red-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Could not extract content
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md">
                                    {readerError}. Try using Full Page mode instead.
                                </p>
                                <button
                                    onClick={() => handleModeChange('full')}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Switch to Full Page
                                </button>
                            </div>
                        ) : readerContent ? (
                            <article className="max-w-3xl mx-auto px-6 py-8 select-text">
                                {/* Article Header */}
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                                        {readerContent.title}
                                    </h1>
                                    {(readerContent.author || readerContent.date) && (
                                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                            {readerContent.author && (
                                                <span>By {readerContent.author}</span>
                                            )}
                                            {readerContent.date && (
                                                <span>{readerContent.date}</span>
                                            )}
                                        </div>
                                    )}
                                    <div className="mt-2 text-xs text-gray-400 truncate">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500">
                                            {url}
                                        </a>
                                    </div>
                                </header>

                                {/* Featured Image */}
                                {readerContent.image && (
                                    <div className="mb-8 rounded-xl overflow-hidden">
                                        <img
                                            src={readerContent.image}
                                            alt=""
                                            className="w-full h-auto"
                                        />
                                    </div>
                                )}

                                {/* Article Content */}
                                <div 
                                    className="prose prose-lg dark:prose-invert max-w-none select-text
                                        prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white
                                        prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
                                        prose-a:text-indigo-600 dark:prose-a:text-indigo-400
                                        prose-strong:text-gray-900 dark:prose-strong:text-white
                                        prose-ul:text-gray-700 dark:prose-ul:text-gray-300
                                        prose-ol:text-gray-700 dark:prose-ol:text-gray-300
                                        prose-blockquote:border-indigo-500 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400"
                                    dangerouslySetInnerHTML={{ __html: readerContent.content }}
                                />
                            </article>
                        ) : !isLoading && (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                    <FileText size={32} className="text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Enter a URL to read
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Paste an article URL and click Go to extract the content.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            </div>

            <ReadingVocabPanel
                selectedText={selectedText}
                selectedSentence={selectedSentence}
                selectionIndices={selectionIndices}
                selectionKey={selectionKey}
                sessionMarkers={sessionMarkers}
                isCollapsed={isPanelCollapsed}
                onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
                onSaveSelection={handleSaveVocab}
                onRemoveMarker={handleRemoveMarker}
                onUpdateVocabData={handleUpdateVocabData}
                firstLanguage={firstLanguage}
                speechLanguage={speechLanguage}
            />
        </div>
    );
}
