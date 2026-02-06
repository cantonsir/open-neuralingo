import React, { useEffect, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Edit, Sparkles, Trash2 } from 'lucide-react';
import { View } from '../../types';
import { api } from '../../db';
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
    topic: string;
    contextId: string;
    library: LibraryItem[];
    history: WritingSession[];
    expandedSession: string | null;
    isSidebarOpen: boolean;
}

const writingComposeCache: WritingComposeCache = {
    initialized: false,
    topic: '',
    contextId: '',
    library: [],
    history: [],
    expandedSession: null,
    isSidebarOpen: true,
};

export default function WritingCompose({ setView, setWritingData }: AppState) {
    const [topic, setTopic] = useState(writingComposeCache.topic);
    const [contextId, setContextId] = useState(writingComposeCache.contextId);
    const [library, setLibrary] = useState<LibraryItem[]>(writingComposeCache.library);
    const [history, setHistory] = useState<WritingSession[]>(writingComposeCache.history);
    const [expandedSession, setExpandedSession] = useState<string | null>(writingComposeCache.expandedSession);
    const [isUploading, setIsUploading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(writingComposeCache.isSidebarOpen);

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
        writingComposeCache.topic = topic;
        writingComposeCache.contextId = contextId;
        writingComposeCache.library = library;
        writingComposeCache.history = history;
        writingComposeCache.expandedSession = expandedSession;
        writingComposeCache.isSidebarOpen = isSidebarOpen;
    }, [topic, contextId, library, history, expandedSession, isSidebarOpen]);

    const startWriting = () => {
        if (!topic.trim() && !contextId) {
            alert('Please enter a topic or select a context.');
            return;
        }

        setWritingData({
            topic: topic.trim() || 'Untitled',
            contextId,
            content: '',
        });
        setView('writer' as View);
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

    const renderSessionCard = (session: WritingSession, compact: boolean = false) => (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md ${compact ? 'text-sm' : ''}`}>
            <div
                onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
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

                        {(topic || contextId) && (
                            <button
                                onClick={() => {
                                    setTopic('');
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
                            {!topic.trim() && !contextId ? (
                                <div className="text-center py-20 opacity-60">
                                    <Sparkles className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Start a new writing session</h3>
                                    <p className="text-sm text-gray-500">Type your topic below and hit send to enter the writer.</p>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready to start</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        Your draft will open in the writer as soon as you continue.
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        <p className="text-gray-700 dark:text-gray-200">
                                            <span className="font-semibold">Topic:</span> {topic.trim() || 'Untitled'}
                                        </p>
                                        {contextId && (
                                            <p className="text-gray-700 dark:text-gray-200">
                                                <span className="font-semibold">Context:</span> {selectedContextTitle}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                    <div className="w-full">
                        <UnifiedInput
                            value={topic}
                            onChange={setTopic}
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
                            placeholder="Describe what you want to write..."
                            enableSpeechInput={true}
                            onSubmit={startWriting}
                            isLoading={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
