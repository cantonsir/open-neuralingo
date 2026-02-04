import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronDown, ChevronUp, Play, Sparkles, MoveRight, Trash2, Download, CheckSquare, Square } from 'lucide-react';
import { View, LibraryItem, ListeningSession, Subtitle } from '../../types';
import { api } from '../../db';
import UnifiedInput from '../common/UnifiedInput';
import { generateListeningDiscussion, chatWithPlanner } from '../../services/geminiService';
import { generateMultiVoiceDialogue, generateSpeech } from '../../services/ttsService';
import { combineSubtitles } from '../../utils/subtitleGenerator';
import { getAudioDuration } from '../../utils/audioAnalyzer';
import { downloadSubtitles } from '../../utils/subtitleExporter';
import { blobUrlToDataUrl, downloadAudio, getAudioFormat } from '../../utils/audioConverter';
import MessageBubble from './MessageBubble';

interface ListeningComposeProps {
    setView: (view: View) => void;
    onLoadSession: (session: ListeningSession) => void;
    targetLanguage: string;
    initialData?: {
        markedWords: string[];
        testSentences: string[];
        aiFeedback: string;
        strengths?: string[];
        weaknesses?: string[];
        recommendations?: string[];
        context: string;
    };
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text?: string;
    session?: ListeningSession;
    timestamp: number;
}

export default function ListeningCompose({ setView, onLoadSession, targetLanguage, initialData }: ListeningComposeProps) {
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
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

    // New State for Upgraded Input
    const [mode, setMode] = useState<'fast' | 'plan'>('fast');
    const [url, setUrl] = useState('');
    const [multiVoice, setMultiVoice] = useState(false);

    const [expandedSession, setExpandedSession] = useState<string | null>(null);

    useEffect(() => {
        api.fetchLibrary().then(setLibrary);
        loadHistory(); // Load history for Sidebar ONLY
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isGenerating]);

    // Auto-populate prompt when initial data is provided
    useEffect(() => {
        if (initialData && initialData.markedWords.length > 0) {
            let generatedPrompt = `Create listening practice for these words/phrases I struggled with: ${initialData.markedWords.join(', ')}.

Test sentences I found difficult:
${initialData.testSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

AI Feedback: ${initialData.aiFeedback}`;

            if (initialData.strengths && initialData.strengths.length > 0) {
                generatedPrompt += `\n\nMy Strengths: ${initialData.strengths.join(', ')}`;
            }

            if (initialData.weaknesses && initialData.weaknesses.length > 0) {
                generatedPrompt += `\n\nMy Weaknesses: ${initialData.weaknesses.join(', ')}`;
            }

            if (initialData.recommendations && initialData.recommendations.length > 0) {
                generatedPrompt += `\n\nRecommendations: ${initialData.recommendations.join(', ')}`;
            }

            generatedPrompt += `\n\nContext: ${initialData.context}`;

            setPrompt(generatedPrompt);
            setContextId('test-results'); // Mark as coming from test
        }
    }, [initialData]);

    const loadHistory = async () => {
        try {
            const sessions = await api.fetchListeningSessions();
            console.log('[ListeningCompose] Loaded sessions:', sessions);
            sessions.forEach((s, i) => {
                console.log(`[ListeningCompose] Session ${i}: subtitles count =`, s.subtitles?.length || 0);
            });
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
        const discussion = await generateListeningDiscussion(userPrompt, contextText, {
            multiVoice,
            languageCode: targetLanguage
        });

        if (discussion.length === 0) {
            throw new Error('Failed to generate discussion.');
        }

        // Format transcript for single-voice generation
        const fullTranscript = discussion
            .map(line => `${line.speaker}: ${line.text}`)
            .join('\n');

        // Generate audio with subtitles
        const ttsResult = multiVoice
            ? await generateMultiVoiceDialogue(discussion, { languageCode: targetLanguage })
            : await generateSpeech({ text: fullTranscript, voiceName: 'Kore', languageCode: targetLanguage });

        // Use result subtitles if available, otherwise estimate
        let subtitles: Subtitle[] = ttsResult.subtitles || [];

        // Estimate duration
        let totalDuration = 0;
        if (ttsResult.duration) {
            totalDuration = ttsResult.duration;
        } else {
            try {
                totalDuration = await getAudioDuration(ttsResult.audioUrl);
            } catch (e) {
                // Fallback estimation
                const totalWordCount = discussion.reduce((acc, line) => acc + line.text.split(' ').length, 0);
                totalDuration = (totalWordCount / 150) * 60;
            }
        }

        // Convert blob URL to data URL for persistence
        console.log('[ListeningCompose] Converting audio blob to data URL for persistence...');
        let persistentAudioUrl = ttsResult.audioUrl;

        if (ttsResult.audioUrl.startsWith('blob:')) {
            try {
                persistentAudioUrl = await blobUrlToDataUrl(ttsResult.audioUrl);
                console.log('[ListeningCompose] ✅ Conversion successful, data URL length:', persistentAudioUrl.length);
            } catch (conversionError) {
                console.error('[ListeningCompose] ⚠️ Failed to convert blob to data URL:', conversionError);
                console.warn('[ListeningCompose] Audio will not persist after reload!');
                // Continue with blob URL (won't work after reload, but better than failing)
            }
        } else {
            console.log('[ListeningCompose] Audio is already a data URL, no conversion needed');
        }

        // Save session
        const session: ListeningSession = {
            id: crypto.randomUUID(),
            prompt: userPrompt,
            audioUrl: persistentAudioUrl,
            transcript: discussion,
            durationSeconds: Math.round(totalDuration),
            contextId: contextId || undefined,
            subtitles: subtitles,
            createdAt: Date.now()
        };

        console.log('[ListeningCompose] Saving session to database:');
        console.log('  - Session ID:', session.id);
        console.log('  - Audio URL type:', persistentAudioUrl.startsWith('blob:') ? 'Blob URL (⚠️ temporary!)' : 'Data URL (✅ persistent)');
        console.log('  - Audio URL (first 100 chars):', persistentAudioUrl.substring(0, 100));
        console.log('  - Subtitles count:', subtitles.length);
        console.log('  - Duration:', totalDuration, 'seconds');
        if (subtitles.length > 0) {
            console.log('  - First subtitle:', subtitles[0]);
            console.log('  - Last subtitle:', subtitles[subtitles.length - 1]);
        }

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
            await Promise.all(ids.map(id => api.deleteListeningSession(id)));
            setHistory(prev => prev.filter(session => !selectedSessionIds.has(session.id)));
            setMessages(prev => prev.filter(msg => !msg.session || !selectedSessionIds.has(msg.session.id)));
            setSelectedSessionIds(new Set());
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Failed to delete selected sessions:', error);
            alert('Failed to delete selected sessions');
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
    const renderSessionCard = (session: ListeningSession, isCompact = false, selectionMode = false) => (
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
                        className="mr-2 text-gray-400 hover:text-amber-500"
                        title={selectedSessionIds.has(session.id) ? 'Deselect' : 'Select'}
                    >
                        {selectedSessionIds.has(session.id)
                            ? <CheckSquare className="w-4 h-4" />
                            : <Square className="w-4 h-4" />}
                    </button>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-gray-900 dark:text-white line-clamp-1 ${isCompact ? 'text-sm' : ''}`}>{session.prompt}</h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        {new Date(session.createdAt).toLocaleDateString()} • {formatDuration(session.durationSeconds)}
                    </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                    {/* Compact Controls for Sidebar */}
                    {session.audioUrl && (
                        <>
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

                            {/* Download Audio Button */}
                            {session.audioUrl && (
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                            const format = getAudioFormat(session.audioUrl);
                                            const filename = `${session.prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}.${format}`;
                                            await downloadAudio(session.audioUrl, filename, `audio/${format}`);
                                        } catch (error) {
                                            console.error('Failed to download audio:', error);
                                            alert('Failed to download audio');
                                        }
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-full transition-colors"
                                    title="Download Audio"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            )}

                            {/* Export Subtitles Dropdown */}
                            {session.subtitles && session.subtitles.length > 0 && (
                                <div className="relative group">
                                    <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                        title="Export Subtitles"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>

                                    {/* Dropdown menu */}
                                    <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadSubtitles(
                                                    session.subtitles!,
                                                    session.prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_'),
                                                    'srt'
                                                );
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg text-gray-700 dark:text-gray-300"
                                        >
                                            Export SRT
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadSubtitles(
                                                    session.subtitles!,
                                                    session.prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_'),
                                                    'vtt'
                                                );
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg text-gray-700 dark:text-gray-300"
                                        >
                                            Export VTT
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
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
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                    <div className={`w-full min-h-full flex flex-col p-4 md:p-8 ${messages.length === 0 ? 'justify-center' : 'justify-start'}`}>
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
                    <div className="w-full">
                        {/* Initial Data Indicator */}
                        {initialData && initialData.markedWords.length > 0 && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    Loaded from test results
                                </div>
                                <div className="text-xs text-blue-700 dark:text-blue-300">
                                    {initialData.markedWords.length} words marked, {initialData.testSentences.length} sentences
                                </div>
                            </div>
                        )}

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
                            multiVoice={multiVoice}
                            onMultiVoiceChange={setMultiVoice}
                            url={url}
                            onUrlChange={setUrl}
                            enableSpeechInput={true}
                            speechLanguage={targetLanguage}
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
