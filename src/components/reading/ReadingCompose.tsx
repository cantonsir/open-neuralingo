import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronDown, ChevronUp, Eye, Sparkles, Trash2, Copy, CheckSquare, Square } from 'lucide-react';
import { View, ReadingSession } from '../../types';
import { api } from '../../db';
import UnifiedInput from '../common/UnifiedInput';
import { generateReadingMaterial, chatWithReadingPlanner } from '../../services/geminiService';
import ReadingMessageBubble from './ReadingMessageBubble';

interface AppState {
    setView: (view: View) => void;
    setReadingData?: (data: any) => void;
}

interface LibraryItem {
    id: string;
    title: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text?: string;
    session?: ReadingSession;
    timestamp: number;
}

export default function ReadingCompose({ setView, setReadingData }: AppState) {
    const [prompt, setPrompt] = useState('');
    const [contextId, setContextId] = useState('');
    const [url, setUrl] = useState('');
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Chat State
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Sidebar/History State
    const [history, setHistory] = useState<ReadingSession[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

    // Mode State
    const [mode, setMode] = useState<'fast' | 'plan'>('fast');
    const [expandedSession, setExpandedSession] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/library')
            .then(res => res.json())
            .then(data => setLibrary(data))
            .catch(console.error);

        loadHistory();
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isGenerating]);

    const loadHistory = async () => {
        try {
            const sessions = await api.fetchReadingSessions();
            setHistory(sessions);
            setSelectedSessionIds(prev => {
                const allowed = new Set(sessions.map(session => session.id));
                const next = new Set([...prev].filter(id => allowed.has(id)));
                if (next.size === 0) {
                    setIsSelectionMode(false);
                }
                return next;
            });
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    };

    const handleInputSubmit = async () => {
        if (!prompt && !contextId && !url && mode === 'fast') {
            alert("Please enter a prompt, provide a URL, or select a context.");
            return;
        }
        if (!prompt && mode === 'plan') {
            return;
        }

        const userPrompt = prompt;
        const tempId = Date.now().toString();

        // 1. Add User Message
        const userMsg: Message = {
            id: `user-${tempId}`,
            role: 'user',
            text: userPrompt,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);
        setPrompt(''); // Clear input immediately
        setIsGenerating(true);

        try {
            if (mode === 'plan') {
                await handlePlanChat([...messages, userMsg]);
            } else {
                await generateReadingSession(userPrompt);
            }
        } catch (error) {
            console.error('Error in submission:', error);
            alert('An error occurred. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePlanChat = async (currentMessages: Message[]) => {
        const history = currentMessages.map(m => ({
            role: m.role,
            text: m.text || ''
        }));

        const aiResponse = await chatWithReadingPlanner(history);

        const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: aiResponse,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsGenerating(false);
    };

    const generateReadingSession = async (userPrompt: string) => {
        // Get context text if contextId is provided
        let contextText = '';
        if (contextId) {
            const item = library.find(l => l.id === contextId);
            if (item) contextText = item.title;
        }

        if (url) {
            contextText += `\nReference URL: ${url}`;
        }

        // Generate reading material
        const material = await generateReadingMaterial(userPrompt || "General topic", contextText);

        if (!material.content || material.title === 'Error') {
            alert('Failed to generate reading material. Please try again.');
            setIsGenerating(false);
            return;
        }

        // Save session
        const sessionData = {
            prompt: userPrompt || "General topic",
            title: material.title,
            content: material.content,
            contextId: contextId || undefined,
            createdAt: Date.now()
        };

        const savedSession = await api.saveReadingSession(sessionData);
        
        // Reload history to get proper ID
        await loadHistory();

        // Create session object for message
        const session: ReadingSession = {
            id: savedSession.id || `session-${Date.now()}`,
            prompt: sessionData.prompt,
            title: sessionData.title,
            content: sessionData.content,
            contextId: sessionData.contextId,
            createdAt: sessionData.createdAt
        };

        // Add Assistant Message with Result
        const assistantMsg: Message = {
            id: `assistant-${session.id}`,
            role: 'assistant',
            session: session,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Clear context
        setContextId('');
    };

    const triggerGenerationFromPlan = async () => {
        setIsGenerating(true);
        // Use the last user prompt or a generic prompt
        const lastUserMsg = messages.filter(m => m.role === 'user').pop();
        const promptToUse = lastUserMsg?.text || "Generate reading material based on our discussion";

        try {
            await generateReadingSession(promptToUse);
        } catch (error) {
            console.error('Generation failed', error);
            alert('Generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (confirm('Are you sure you want to delete this session?')) {
            try {
                await api.deleteReadingSession(sessionId);
                await loadHistory();
                // Remove from chat if present
                setMessages(prev => prev.filter(m => m.session?.id !== sessionId));
            } catch (error) {
                console.error('Failed to delete session:', error);
                alert('Failed to delete session');
            }
        }
    };

    const toggleSessionSelection = (sessionId: string) => {
        setSelectedSessionIds(prev => {
            const next = new Set(prev);
            if (next.has(sessionId)) {
                next.delete(sessionId);
            } else {
                next.add(sessionId);
            }
            return next;
        });
    };

    const handleDeleteSelectedSessions = async () => {
        if (selectedSessionIds.size === 0) return;
        const count = selectedSessionIds.size;
        if (!confirm(`Delete ${count} selected session${count > 1 ? 's' : ''}?`)) return;

        try {
            const ids = Array.from(selectedSessionIds);
            await Promise.all(ids.map(id => api.deleteReadingSession(id)));
            setHistory(prev => prev.filter(session => !selectedSessionIds.has(session.id)));
            setMessages(prev => prev.filter(msg => !msg.session || !selectedSessionIds.has(msg.session.id)));
            setSelectedSessionIds(new Set());
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Failed to delete selected sessions:', error);
            alert('Failed to delete selected sessions');
        }
    };

    const openReadingSession = (session: ReadingSession) => {
        if (setReadingData) {
            setReadingData({
                libraryId: session.id,
                title: session.title,
                content: session.content
            });
            setView('reader');
        }
    };

    const copySessionContent = async (session: ReadingSession) => {
        try {
            await navigator.clipboard.writeText(session.content);
            alert('Content copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
            alert('Failed to copy content');
        }
    };

    const formatDuration = (createdAt: number) => {
        const date = new Date(createdAt);
        return date.toLocaleDateString();
    };

    // Render helper for the session card
    const renderSessionCard = (session: ReadingSession, isCompact = false, selectionMode = false) => (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md w-full ${isCompact ? 'text-sm' : ''}`}>
            <div
                onClick={() => {
                    if (isCompact && selectionMode) {
                        toggleSessionSelection(session.id);
                        return;
                    }
                    setExpandedSession(expandedSession === session.id ? null : session.id);
                }}
                className={`flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${isCompact ? 'p-3' : 'p-4'}`}
            >
                {isCompact && selectionMode && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleSessionSelection(session.id);
                        }}
                        className="mr-2 text-gray-400 hover:text-blue-500"
                        title={selectedSessionIds.has(session.id) ? 'Deselect' : 'Select'}
                    >
                        {selectedSessionIds.has(session.id)
                            ? <CheckSquare className="w-4 h-4" />
                            : <Square className="w-4 h-4" />}
                    </button>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-gray-900 dark:text-white line-clamp-1 ${isCompact ? 'text-sm' : ''}`}>{session.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        {formatDuration(session.createdAt)} • {session.prompt.substring(0, 30)}...
                    </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                    {/* Read Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openReadingSession(session);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                        title="Read"
                    >
                        <Eye className="w-4 h-4" />
                    </button>

                    {/* Copy Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            copySessionContent(session);
                        }}
                        className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                        title="Copy Content"
                    >
                        <Copy className="w-4 h-4" />
                    </button>

                    {/* Expand/Collapse */}
                    <div className="text-gray-400">
                        {expandedSession === session.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {expandedSession === session.id && (
                <div className={`border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 ${isCompact ? 'p-3' : 'p-4'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400">Preview</h4>
                        {isCompact && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSession(session.id);
                                }}
                                className="text-xs text-red-500 hover:underline flex items-center gap-1"
                            >
                                <Trash2 className="w-3 h-3" />
                                Delete
                            </button>
                        )}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                            {session.content.substring(0, 300)}
                            {session.content.length > 300 && '...'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-1 bg-gray-50 dark:bg-gray-900 overflow-hidden relative">

            {/* Sidebar (History) */}
            <div className={`flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 flex-shrink-0 ${isSidebarOpen ? 'w-72' : 'w-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            History
                        </h2>
                        <span className="text-xs text-gray-400">{history.length} sessions</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSelectionMode ? (
                            <>
                                <button
                                    onClick={handleDeleteSelectedSessions}
                                    disabled={selectedSessionIds.size === 0}
                                    className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${selectedSessionIds.size === 0
                                        ? 'text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                                        : 'text-white bg-red-500 hover:bg-red-600'
                                        }`}
                                >
                                    Delete {selectedSessionIds.size > 0 ? `(${selectedSessionIds.size})` : ''}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSelectionMode(false);
                                        setSelectedSessionIds(new Set());
                                    }}
                                    className="text-xs font-medium px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsSelectionMode(true)}
                                className="text-xs font-medium px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Select
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            No history yet.
                        </div>
                    ) : (
                        history.map(session => (
                            <div key={session.id}>
                                {renderSessionCard(session, true, isSelectionMode)}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Header & Toggle */}
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
                                <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                                    Reading Generator
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">AI Reading Generator</p>
                            </div>
                        </div>

                        {/* Generate Button (Plan Mode Only) */}
                        {mode === 'plan' && messages.length > 0 && (
                            <button
                                onClick={triggerGenerationFromPlan}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm animate-pulse"
                            >
                                <Sparkles className="w-4 h-4" />
                                {isGenerating ? 'Generating...' : 'Create Session'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                    <div className={`w-full min-h-full flex flex-col p-4 md:p-8 ${messages.length === 0 ? 'justify-center' : 'justify-start'}`}>
                        {messages.length === 0 && (
                            <div className="text-center py-20 opacity-50">
                                <Sparkles className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Start a conversation</h3>
                                <p className="text-sm text-gray-500">
                                    {mode === 'plan' ? 'Collaborate with AI to design your reading material.' : 'Describe a topic to generate instantly.'}
                                </p>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <ReadingMessageBubble
                                key={msg.id}
                                role={msg.role}
                                text={msg.text}
                                session={msg.session}
                                renderSessionCard={(s) => renderSessionCard(s, false)}
                            />
                        ))}

                        {isGenerating && (
                            <ReadingMessageBubble role="assistant" isTyping={true} />
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Sticky Input Area */}
                <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                    <div className="w-full">
                        <UnifiedInput
                            value={prompt}
                            onChange={setPrompt}
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
                            themeColor="blue"
                            placeholder="Describe a topic for reading practice..."
                            mode={mode}
                            onModeChange={setMode}
                            url={url}
                            onUrlChange={setUrl}
                            enableSpeechInput={true}
                            onSubmit={handleInputSubmit}
                            isLoading={isGenerating}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
