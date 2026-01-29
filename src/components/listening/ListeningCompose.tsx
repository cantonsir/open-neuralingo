import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronDown, ChevronUp, Play, Sparkles, MoveRight, Trash2 } from 'lucide-react';
import { View, LibraryItem, ListeningSession } from '../../types';
import { api } from '../../db';
import UnifiedInput from '../common/UnifiedInput';
import { generateListeningDiscussion, chatWithPlanner } from '../../services/geminiService';
import { generateDialogue } from '../../services/ttsService';
import MessageBubble from './MessageBubble';

interface ListeningComposeProps {
    setView: (view: View) => void;
    onLoadSession: (session: ListeningSession) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text?: string;
    session?: ListeningSession;
    timestamp: number;
}

export default function ListeningCompose({ setView, onLoadSession }: ListeningComposeProps) {
    const [prompt, setPrompt] = useState('');
    const [contextId, setContextId] = useState('');
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Chat State
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Sidebar/History State
    const [history, setHistory] = useState<ListeningSession[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // New State for Upgraded Input
    const [mode, setMode] = useState<'fast' | 'plan'>('fast');
    const [url, setUrl] = useState('');

    const [expandedSession, setExpandedSession] = useState<string | null>(null);

    useEffect(() => {
        api.fetchLibrary().then(setLibrary);
        loadHistory(); // Load history for Sidebar ONLY
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isGenerating]);

    const loadHistory = async () => {
        try {
            const sessions = await api.fetchListeningSessions();
            setHistory(sessions);
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
                await generateAudioSession(userPrompt);
            }
        } catch (error) {
            console.error('Operation failed:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePlanChat = async (history: Message[]) => {
        // Convert internal messages to format expected by service
        const chatHistory = history.map(m => ({
            role: m.role,
            text: m.text || (m.session ? `[Generated Audio Session: ${m.session.prompt}]` : '')
        }));

        const reply = await chatWithPlanner(chatHistory);

        const assistantMsg: Message = {
            id: `assistant-plan-${Date.now()}`,
            role: 'assistant',
            text: reply,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMsg]);
    };

    const generateAudioSession = async (userPrompt: string, isFromPlan = false) => {
        // Get context text if contextId is provided
        let contextText = '';
        if (contextId) {
            const item = library.find(l => l.id === contextId);
            if (item) contextText += `\nLibrary Context: ${item.title}`;
        }
        if (url) {
            contextText += `\nReference URL: ${url}`;
        }

        // If coming from Plan Key, include recent chat history as context
        if (isFromPlan) {
            const recentChat = messages.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n');
            contextText += `\n\nPLANNING CONTEXT:\n${recentChat}`;
            // Mark context as plan mode so generator knows to look for details
            contextText += `\n(Based on the above planning discussion)`;
        } else {
            if (mode === 'plan') {
                // Should not happen really if called directly, but for safety
                contextText += `\n(User requested PLAN mode)`;
            } else {
                contextText += `\n(User requested FAST mode: direct and concise output)`;
            }
        }

        // Generate discussion script
        const discussion = await generateListeningDiscussion(userPrompt, contextText);

        if (discussion.length === 0) {
            throw new Error('Failed to generate discussion.');
        }

        // Format transcript for multi-speaker generation
        const fullTranscript = discussion
            .map(line => `${line.speaker}: ${line.text}`)
            .join('\n');

        // Generate single audio file for the entire dialogue
        const mainAudioUrl = await generateDialogue(fullTranscript, 'Aoede');

        // Estimate duration (rough: ~150 words per minute)
        const totalWordCount = discussion.reduce((acc, line) => acc + line.text.split(' ').length, 0);
        const totalDuration = (totalWordCount / 150) * 60;

        // Save session
        const session: ListeningSession = {
            id: crypto.randomUUID(),
            prompt: userPrompt,
            audioUrl: mainAudioUrl,
            transcript: discussion,
            durationSeconds: Math.round(totalDuration),
            contextId: contextId || undefined,
            createdAt: Date.now()
        };

        await api.saveListeningSession(session);

        // Sync Sidebar
        await loadHistory();

        // 2. Add Assistant Message with Result
        const assistantMsg: Message = {
            id: `assistant-${session.id}`,
            role: 'assistant',
            session: session,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Clear other form fields
        setContextId('');
        setUrl('');
    };

    const triggerGenerationFromPlan = async () => {
        setIsGenerating(true);
        // Use the last user prompt or a generic "Generate based on our discussion"
        const lastUserMsg = messages.filter(m => m.role === 'user').pop();
        const promptToUse = lastUserMsg?.text || "Generate audio session based on plan";

        try {
            await generateAudioSession(promptToUse, true);
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
                await api.deleteListeningSession(sessionId);
                await loadHistory(); // Update sidebar
                // Remove from chat if present (optional, but good UX)
                setMessages(prev => prev.filter(m => m.session?.id !== sessionId));
            } catch (error) {
                console.error('Failed to delete session:', error);
                alert('Failed to delete session');
            }
        }
    };

    const formatTime = (ms: number) => {
        return new Date(ms).toLocaleDateString() + ' ' + new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Render helper for the session card
    const renderSessionCard = (session: ListeningSession, isCompact = false) => (
        <div className={`bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md w-full ${isCompact ? 'text-sm' : ''}`}>
            <div
                onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                className={`flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${isCompact ? 'p-3' : 'p-4'}`}
            >
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-gray-900 dark:text-white line-clamp-1 ${isCompact ? 'text-sm' : ''}`}>{session.prompt}</h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        {new Date(session.createdAt).toLocaleDateString()} • {formatDuration(session.durationSeconds)}
                    </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                    {/* Compact Controls for Sidebar */}
                    {session.audioUrl && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onLoadSession(session);
                            }}
                            className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors"
                            title="Play"
                        >
                            <Play className="w-4 h-4" />
                        </button>
                    )}

                    {!isCompact && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}

                    <div className="text-gray-400">
                        {expandedSession === session.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </div>

            {expandedSession === session.id && (
                <div className={`border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 ${isCompact ? 'p-3' : 'p-4'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400">Transcript</h4>
                        {isCompact && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSession(session.id);
                                }}
                                className="text-xs text-red-500 hover:underline"
                            >
                                Delete
                            </button>
                        )}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                        {session.transcript.map((line, idx) => (
                            <div key={idx} className="flex gap-2">
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex-shrink-0 w-16 truncate">
                                    {line.speaker}
                                </span>
                                <span className="text-xs text-gray-800 dark:text-gray-200">
                                    {line.text}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex h-full bg-gray-50 dark:bg-gray-900 overflow-hidden relative">

            {/* Sidebar (History) */}
            <div className={`flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        History
                    </h2>
                    <span className="text-xs text-gray-400">{history.length} sessions</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            No history yet.
                        </div>
                    ) : (
                        history.map(session => (
                            <div key={session.id}>
                                {renderSessionCard(session, true)}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Header & Toggle */}
                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
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
                            <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-400 dark:to-orange-400">
                                Listening Practice
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">AI Audio Generator</p>
                        </div>
                    </div>

                    {/* Generate Button (Plan Mode Only) */}
                    {mode === 'plan' && messages.length > 0 && (
                        <button
                            onClick={triggerGenerationFromPlan}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm animate-pulse"
                        >
                            <Sparkles className="w-4 h-4" />
                            {isGenerating ? 'Generating...' : 'Create Session'}
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
                    <div className="max-w-4xl mx-auto flex flex-col justify-end min-h-0">
                        {messages.length === 0 && (
                            <div className="text-center py-20 opacity-50">
                                <Sparkles className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Start a conversation</h3>
                                <p className="text-sm text-gray-500">
                                    {mode === 'plan' ? 'Collaborate with AI to design your session.' : 'Describe a topic to generate instantly.'}
                                </p>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                role={msg.role}
                                text={msg.text}
                                session={msg.session}
                                renderSessionCard={(s) => renderSessionCard(s, false)}
                            />
                        ))}

                        {isGenerating && (
                            <MessageBubble role="assistant" isTyping={true} />
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Sticky Input Area */}
                <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                    <div className="max-w-4xl mx-auto">
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
                            themeColor="amber"
                            placeholder={mode === 'plan' ? "Discuss your idea..." : "Describe a topic for listening practice..."}
                            mode={mode}
                            onModeChange={setMode}
                            url={url}
                            onUrlChange={setUrl}
                            onSubmit={handleInputSubmit}
                            isLoading={isGenerating}
                            className="shadow-xl border-gray-200 dark:border-gray-700"
                        />
                        <div className="text-center mt-2 text-xs text-gray-400 dark:text-gray-600">
                            AI-generated content may be inaccurate.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
