import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Mic, MessageSquare, Trash2 } from 'lucide-react';
import { View, LibraryItem, SpeakingSession } from '../../types';
import { api } from '../../db';
import UnifiedInput from '../common/UnifiedInput';
import { generateTextChatResponse } from '../../services/geminiService';

interface AppState {
    setView: (view: View) => void;
    setSpeakingData: (data: any) => void;
    speechLanguage?: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

export default function SpeakingScenario({ setView, setSpeakingData, speechLanguage }: AppState) {
    const [prompt, setPrompt] = useState('');
    const [contextId, setContextId] = useState('');
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [history, setHistory] = useState<SpeakingSession[]>([]);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [topic, setTopic] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<ChatMessage[]>([]);
    const topicRef = useRef('');
    const startTimeRef = useRef<number | null>(null);
    const hasSavedRef = useRef(false);



    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        topicRef.current = topic;
    }, [topic]);

    const loadHistory = useCallback(async () => {
        try {
            const sessions = await api.fetchSpeakingSessions();
            setHistory(sessions);
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }, []);

    useEffect(() => {
        api.fetchLibrary().then(setLibrary);
        loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isGenerating]);

    const formatTime = (ms: number) => {
        return new Date(ms).toLocaleDateString() + ' ' + new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const sendUserMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const now = Date.now();
        if (!startTimeRef.current) {
            startTimeRef.current = now;
        }

        let activeTopic = topicRef.current;
        if (!activeTopic) {
            const contextTitle = contextId ? library.find((item) => item.id === contextId)?.title : '';
            activeTopic = contextTitle ? `${trimmed} (Context: ${contextTitle})` : trimmed;
            topicRef.current = activeTopic;
            setTopic(activeTopic);
        }

        const userMessage: ChatMessage = {
            id: `user-${now}`,
            role: 'user',
            text: trimmed,
            timestamp: now
        };

        setMessages((prev) => [...prev, userMessage]);
        setPrompt('');
        setIsGenerating(true);

        try {
            const historyPayload = [...messagesRef.current, userMessage].map((msg) => ({
                role: msg.role,
                text: msg.text
            }));

            const aiText = await generateChatResponse(historyPayload, activeTopic || trimmed);
            const responseText = aiText?.trim() || "I'm having trouble responding right now.";

            const aiMessage: ChatMessage = {
                id: `model-${Date.now()}`,
                role: 'model',
                text: responseText,
                timestamp: Date.now()
            };

            setMessages((prev) => [...prev, aiMessage]);
        } catch (error) {
            console.error('Failed to generate response:', error);
            const aiMessage: ChatMessage = {
                id: `model-${Date.now()}`,
                role: 'model',
                text: "I'm having trouble responding right now.",
                timestamp: Date.now()
            };
            setMessages((prev) => [...prev, aiMessage]);
        } finally {
            setIsGenerating(false);
        }
    }, [contextId, library]);

    const handleInputSubmit = useCallback(() => {
        const trimmed = prompt.trim();
        const contextTitle = contextId ? library.find((item) => item.id === contextId)?.title : '';

        if (!trimmed && !contextTitle) {
            alert('Please enter a topic or select a context.');
            return;
        }

        const text = trimmed || `Let's talk about ${contextTitle}`;
        sendUserMessage(text);
    }, [prompt, contextId, library, sendUserMessage]);

    const persistSession = useCallback(async () => {
        if (hasSavedRef.current) return;

        const transcript = messagesRef.current;
        if (transcript.length === 0) return;

        const createdAt = startTimeRef.current || transcript[0]?.timestamp || Date.now();
        const durationSeconds = Math.max(1, Math.round((Date.now() - createdAt) / 1000));
        const sessionTopic = topicRef.current || transcript[0]?.text || 'Conversation';

        try {
            await api.saveSpeakingSession({
                topic: sessionTopic,
                transcript: transcript.map((msg) => ({ role: msg.role, text: msg.text })),
                durationSeconds,
                createdAt
            });
            hasSavedRef.current = true;
        } catch (error) {
            console.error('Failed to save session:', error);
        }
    }, []);

    useEffect(() => {
        return () => {
            void persistSession();
        };
    }, [persistSession]);

    const handleStartLiveChat = () => {
        const contextTitle = contextId ? library.find((item) => item.id === contextId)?.title : '';
        const seed = topicRef.current || prompt.trim() || contextTitle || 'General Conversation';
        setSpeakingData({
            mode: 'live',
            topic: seed,
            contextId
        });
        setView('conversation');
    };

    return (
        <div className="flex flex-1 bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
            <div className={`flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 flex-shrink-0 ${isSidebarOpen ? 'w-72' : 'w-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            History
                        </h2>
                        <span className="text-xs text-gray-400">{history.length} sessions</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            No history yet.
                        </div>
                    ) : (
                        history.map((session) => (
                            <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div
                                    onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{session.topic || 'Conversation'}</h3>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {formatTime(session.createdAt)} • {formatDuration(session.durationSeconds)}
                                        </p>
                                    </div>
                                    <div className="text-gray-400">
                                        {expandedSession === session.id ? <ChevronUp /> : <ChevronDown />}
                                    </div>
                                </div>

                                {expandedSession === session.id && (
                                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400">Transcript</h4>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Delete this conversation?')) {
                                                        try {
                                                            await api.deleteSpeakingSession(session.id);
                                                            setHistory((prev) => prev.filter((s) => s.id !== session.id));
                                                            setExpandedSession(null);
                                                        } catch (error) {
                                                            console.error('Failed to delete session:', error);
                                                            alert('Failed to delete session.');
                                                        }
                                                    }
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete conversation"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                            {session.transcript.length === 0 ? (
                                                <p className="text-xs text-gray-400">No transcript available.</p>
                                            ) : (
                                                session.transcript.map((msg, idx) => (
                                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user'
                                                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
                                                            : 'bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                                                            }`}>
                                                            <span className="text-xs font-bold opacity-50 block mb-1">
                                                                {msg.role === 'user' ? 'You' : 'AI'}
                                                            </span>
                                                            {msg.text}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
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
                                <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-600 dark:from-emerald-400 dark:to-green-400">
                                    Conversation
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {topic ? `Topic: ${topic}` : 'AI text replies with your voice input.'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleStartLiveChat}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg shadow-md transition-all active:scale-95 font-medium text-sm"
                        >
                            <Mic className="w-4 h-4" />
                            Start Live Chat
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                    <div className={`w-full min-h-full flex flex-col p-4 md:p-8 ${messages.length === 0 ? 'justify-center' : 'justify-start'}`}>
                        {messages.length === 0 && (
                            <div className="text-center py-20 opacity-60">
                                <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Start a conversation</h3>
                                <p className="text-sm text-gray-500">
                                    Describe a topic or tap the mic to respond.
                                </p>
                            </div>
                        )}

                        {messages.map((msg) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
                                    <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${isUser
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                                            }`}>
                                            {isUser ? <Mic className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                                        </div>
                                        <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-base leading-relaxed break-words whitespace-pre-wrap ${isUser
                                            ? 'bg-emerald-600 text-white rounded-tr-none'
                                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {isGenerating && (
                            <div className="flex w-full justify-start mb-6">
                                <div className="flex max-w-[90%] md:max-w-[80%] gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                                        <MessageSquare className="w-4 h-4" />
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <div className="flex gap-1.5 pt-1">
                                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

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
                                    const data = await api.fetchLibrary();
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
                            themeColor="emerald"
                            placeholder="Describe a topic for conversation..."
                            enableSpeechInput={true}
                            speechLanguage={speechLanguage}
                            onSubmit={handleInputSubmit}
                            isLoading={isGenerating}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
