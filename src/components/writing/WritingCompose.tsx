import React, { useEffect, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Edit, Sparkles, Trash2, X } from 'lucide-react';
import { View, WritingAiReview } from '../../types';
import { api } from '../../db';
import { summarizeWritingTitle } from '../../services/geminiService';
import UnifiedInput from '../common/UnifiedInput';

interface AppState {
    setView: (view: View) => void;
    setWritingData: (data: any) => void;
}

interface LibraryItem {
    id: string;
    title: string;
}

interface WritingSession {
    id: string;
    topic: string;
    content: string;
    contextId?: string;
    createdAt: number;
    updatedAt: number;
}

interface WritingComposeCache {
    initialized: boolean;
    draftContent: string;
    titleInput: string;
    contextId: string;
    library: LibraryItem[];
    history: WritingSession[];
    expandedSession: string | null;
    isSidebarOpen: boolean;
}

const writingComposeCache: WritingComposeCache = {
    initialized: false,
    draftContent: '',
    titleInput: '',
    contextId: '',
    library: [],
    history: [],
    expandedSession: null,
    isSidebarOpen: true,
};

export default function WritingCompose({ setView, setWritingData }: AppState) {
    const [draftContent, setDraftContent] = useState(writingComposeCache.draftContent);
    const [titleInput, setTitleInput] = useState(writingComposeCache.titleInput);
    const [contextId, setContextId] = useState(writingComposeCache.contextId);
    const [library, setLibrary] = useState<LibraryItem[]>(writingComposeCache.library);
    const [history, setHistory] = useState<WritingSession[]>(writingComposeCache.history);
    const [expandedSession, setExpandedSession] = useState<string | null>(writingComposeCache.expandedSession);
    const [isUploading, setIsUploading] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(writingComposeCache.isSidebarOpen);
    const [reviewsBySession, setReviewsBySession] = useState<Record<string, WritingAiReview[]>>({});
    const [loadingReviewsSessionId, setLoadingReviewsSessionId] = useState<string | null>(null);
    const [selectedReview, setSelectedReview] = useState<WritingAiReview | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadInitialData = async () => {
            try {
                const [libraryRes, sessions] = await Promise.all([
                    fetch('/api/library').then(res => res.json()),
                    api.fetchWritingSessions(),
                ]);

                if (!isMounted) {
                    return;
                }

                setLibrary(libraryRes);
                setHistory(sessions);
                writingComposeCache.initialized = true;
            } catch (error) {
                console.error('Failed to load writing compose data:', error);
            }
        };

        loadInitialData();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        writingComposeCache.initialized = true;
        writingComposeCache.draftContent = draftContent;
        writingComposeCache.titleInput = titleInput;
        writingComposeCache.contextId = contextId;
        writingComposeCache.library = library;
        writingComposeCache.history = history;
        writingComposeCache.expandedSession = expandedSession;
        writingComposeCache.isSidebarOpen = isSidebarOpen;
    }, [draftContent, titleInput, contextId, library, history, expandedSession, isSidebarOpen]);

    const startWriting = async () => {
        if (!draftContent.trim()) {
            alert('Please write your draft content first.');
            return;
        }

        try {
            setIsStarting(true);
            const resolvedTitle = titleInput.trim() || await summarizeWritingTitle(draftContent);

            setWritingData({
                topic: resolvedTitle || 'Untitled Draft',
                contextId,
                content: draftContent,
            });
            setView('writer' as View);
        } finally {
            setIsStarting(false);
        }
    };

    const openWritingSession = (session: WritingSession) => {
        setWritingData({
            id: session.id,
            topic: session.topic,
            contextId: session.contextId,
            content: session.content,
        });
        setView('writer' as View);
    };

    const handleDeleteSession = async (sessionId: string) => {
        const ok = window.confirm('Delete this writing session?');
        if (!ok) {
            return;
        }

        try {
            await api.deleteWritingSession(sessionId);
            setHistory(prev => prev.filter(session => session.id !== sessionId));
            if (expandedSession === sessionId) {
                setExpandedSession(null);
            }
        } catch (error) {
            console.error('Failed to delete writing session:', error);
            alert('Failed to delete writing session');
        }
    };

    const formatTime = (ms: number) => {
        return new Date(ms).toLocaleDateString() + ' ' + new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const selectedContextTitle = contextId
        ? library.find(item => item.id === contextId)?.title || 'Selected context'
        : '';

    const loadReviewsForSession = async (sessionId: string) => {
        if (reviewsBySession[sessionId]) {
            return;
        }

        try {
            setLoadingReviewsSessionId(sessionId);
            const reviews = await api.fetchWritingReviews(sessionId);
            setReviewsBySession(prev => ({ ...prev, [sessionId]: reviews }));
        } catch (error) {
            console.error('Failed to load writing reviews:', error);
            setReviewsBySession(prev => ({ ...prev, [sessionId]: [] }));
        } finally {
            setLoadingReviewsSessionId(null);
        }
    };

    const renderSessionCard = (session: WritingSession, compact: boolean = false) => (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md ${compact ? 'text-sm' : ''}`}>
            <div
                onClick={() => {
                    const willExpand = expandedSession !== session.id;
                    setExpandedSession(willExpand ? session.id : null);
                    if (willExpand) {
                        loadReviewsForSession(session.id);
                    }
                }}
                className={`flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${compact ? 'p-3' : 'p-4'}`}
            >
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-gray-900 dark:text-white line-clamp-1 ${compact ? 'text-sm' : ''}`}>
                        {session.topic || 'Untitled'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        {formatTime(session.updatedAt || session.createdAt)} • {(session.content || '').length} characters
                    </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openWritingSession(session);
                        }}
                        className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-full transition-colors"
                        title="Edit"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="text-gray-400">
                        {expandedSession === session.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </div>

            {expandedSession === session.id && (
                <div className={`border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 ${compact ? 'p-3' : 'p-4'}`}>
                    <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-2">Preview</h4>
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {session.content?.substring(0, 300) || '(Empty)'}
                        {(session.content?.length || 0) > 300 && '...'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <h5 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-2">Saved AI Reviews</h5>
                        {loadingReviewsSessionId === session.id ? (
                            <p className="text-xs text-gray-500">Loading reviews...</p>
                        ) : (reviewsBySession[session.id] || []).length === 0 ? (
                            <p className="text-xs text-gray-500">No saved AI reviews yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {(reviewsBySession[session.id] || []).slice(0, 3).map(review => (
                                    <div key={review.id} className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-semibold text-indigo-600 dark:text-indigo-300">Score {review.score}/100</span>
                                            <span className="text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                                            {(review.suggestions && review.suggestions[0]) || (review.strengths && review.strengths[0]) || 'Saved review'}
                                        </p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedReview(review);
                                            }}
                                            className="mt-2 text-[11px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            Open Review
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-1 bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
            <div className={`flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 flex-shrink-0 ${isSidebarOpen ? 'w-72' : 'w-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        History
                    </h2>
                    <span className="text-xs text-gray-400">{history.length} sessions</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">No history yet.</div>
                    ) : (
                        history.map(session => (
                            <div key={session.id}>{renderSessionCard(session, true)}</div>
                        ))
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 relative">
                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 shadow-sm">
                    <div className="w-full px-4 md:px-8 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                            >
                                <div className="space-y-1">
                                    <span className="block w-5 h-0.5 bg-current"></span>
                                    <span className="block w-5 h-0.5 bg-current"></span>
                                    <span className="block w-5 h-0.5 bg-current"></span>
                                </div>
                            </button>
                            <div>
                                <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-600 dark:from-purple-400 dark:to-pink-400">
                                    Writing Generator
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Create your next composition with context-aware prompts</p>
                            </div>
                        </div>

                        {(draftContent || contextId || titleInput) && (
                            <button
                                onClick={() => {
                                    setDraftContent('');
                                    setTitleInput('');
                                    setContextId('');
                                }}
                                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Clear Draft
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                    <div className="w-full min-h-full flex items-center justify-center p-4 md:p-8">
                        <div className="max-w-3xl w-full">
                            {!draftContent.trim() && !contextId ? (
                                <div className="text-center py-20 opacity-60">
                                    <Sparkles className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Start a new writing session</h3>
                                    <p className="text-sm text-gray-500">Paste or write your full draft below. Title can be auto-generated.</p>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready to start</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        Your draft will open in the writer as soon as you continue.
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        <p className="text-gray-700 dark:text-gray-200">
                                            <span className="font-semibold">Title:</span> {titleInput.trim() || 'Will be generated automatically'}
                                        </p>
                                        <p className="text-gray-700 dark:text-gray-200">
                                            <span className="font-semibold">Words:</span> {draftContent.trim() ? draftContent.trim().split(/\s+/).length : 0}
                                        </p>
                                        {contextId && (
                                            <p className="text-gray-700 dark:text-gray-200">
                                                <span className="font-semibold">Context:</span> {selectedContextTitle}
                                            </p>
                                        )}
                                    </div>
                                    <div className="mt-4">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Optional title</label>
                                        <input
                                            value={titleInput}
                                            onChange={(e) => setTitleInput(e.target.value)}
                                            placeholder="Leave empty to auto-generate from draft"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                    <div className="w-full">
                        <UnifiedInput
                            value={draftContent}
                            onChange={setDraftContent}
                            contextId={contextId}
                            onClearContext={() => setContextId('')}
                            library={library}
                            onContextSelect={setContextId}
                            onFileUpload={async (file) => {
                                try {
                                    setIsUploading(true);
                                    const result = await api.uploadFile(file);
                                    const res = await fetch('/api/library');
                                    const data = await res.json();
                                    setLibrary(data);
                                    setContextId(result.id);
                                } catch (error) {
                                    console.error('Upload failed:', error);
                                    alert('Failed to upload file.');
                                } finally {
                                    setIsUploading(false);
                                }
                            }}
                            isUploading={isUploading}
                            themeColor="purple"
                            placeholder="Write your composition draft here..."
                            enableSpeechInput={true}
                            onSubmit={startWriting}
                            isLoading={isStarting}
                        />
                    </div>
                </div>
            </div>

            {selectedReview && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl">
                        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Saved AI Review</h3>
                                <p className="text-xs text-gray-500">{selectedReview.topic} • Score {selectedReview.score}/100</p>
                            </div>
                            <button onClick={() => setSelectedReview(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 text-sm">
                            <div>
                                <h4 className="font-semibold mb-1 text-gray-700 dark:text-gray-200">Top Suggestions</h4>
                                <ul className="list-disc ml-5 space-y-1 text-gray-600 dark:text-gray-300">
                                    {(selectedReview.suggestions || []).map((item, idx) => (
                                        <li key={`s-${idx}`}>{item}</li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-1 text-gray-700 dark:text-gray-200">Corrected Draft</h4>
                                <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                                    {selectedReview.correctedText}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
