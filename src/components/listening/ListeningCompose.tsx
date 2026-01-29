import React, { useState, useEffect } from 'react';
import { Volume2, Clock, ChevronDown, ChevronUp, Play, Pause, Sparkles } from 'lucide-react';
import { View, LibraryItem, ListeningSession } from '../../types';
import { api } from '../../db';
import UnifiedInput from '../common/UnifiedInput';
import { generateListeningDiscussion, DiscussionLine } from '../../services/geminiService';
import { generateSpeech } from '../../services/ttsService';

interface AppState {
    setView: (view: View) => void;
}

export default function ListeningCompose({ setView }: AppState) {
    const [prompt, setPrompt] = useState('');
    const [contextId, setContextId] = useState('');
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [history, setHistory] = useState<ListeningSession[]>([]);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [playingAudio, setPlayingAudio] = useState<string | null>(null);
    const [audioElements, setAudioElements] = useState<{ [key: string]: HTMLAudioElement }>({});

    // New State for Upgraded Input
    const [mode, setMode] = useState<'fast' | 'plan'>('fast');
    const [url, setUrl] = useState('');

    useEffect(() => {
        api.fetchLibrary().then(setLibrary);
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const sessions = await api.fetchListeningSessions();
            setHistory(sessions);
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    };

    const generateAudioDiscussion = async () => {
        if (!prompt && !contextId && !url) {
            alert("Please enter a prompt, provide a URL, or select a context.");
            return;
        }

        setIsGenerating(true);
        try {
            // Get context text if contextId is provided
            let contextText = '';
            if (contextId) {
                const item = library.find(l => l.id === contextId);
                if (item) contextText += `\nLibrary Context: ${item.title}`;
            }
            if (url) {
                contextText += `\nReference URL: ${url}`;
            }
            if (mode === 'plan') {
                contextText += `\n(User requested PLAN mode: potentially more detailed or structured output)`;
            } else {
                contextText += `\n(User requested FAST mode: direct and concise output)`;
            }

            // Generate discussion script
            const discussion = await generateListeningDiscussion(prompt || "General conversation", contextText);

            if (discussion.length === 0) {
                alert('Failed to generate discussion. Please try again.');
                setIsGenerating(false);
                return;
            }

            // Generate audio for each line with proper voice assignment
            const availableVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];
            const speakerVoiceMap: { [speaker: string]: string } = {};
            let nextVoiceIndex = 0;

            const audioUrls: string[] = [];
            let totalDuration = 0;

            for (let i = 0; i < discussion.length; i++) {
                const line = discussion[i];

                // Assign voice to speaker if not already assigned
                if (!speakerVoiceMap[line.speaker]) {
                    speakerVoiceMap[line.speaker] = availableVoices[nextVoiceIndex % availableVoices.length];
                    nextVoiceIndex++;
                }

                const voice = speakerVoiceMap[line.speaker];

                const audioUrl = await generateSpeech({ text: line.text, voiceName: voice });
                if (audioUrl) {
                    audioUrls.push(audioUrl);
                    // Estimate duration (rough: ~150 words per minute)
                    const wordCount = line.text.split(' ').length;
                    totalDuration += (wordCount / 150) * 60;
                }
            }

            // For now, we'll use the first audio URL as the main URL
            // In a production system, you'd concatenate these into a single audio file
            const mainAudioUrl = audioUrls.length > 0 ? audioUrls[0] : '';

            // Save session
            const session = {
                prompt: prompt || "General conversation",
                audioUrl: mainAudioUrl,
                transcript: discussion,
                durationSeconds: Math.round(totalDuration),
                contextId: contextId || undefined,
                createdAt: Date.now()
            };

            await api.saveListeningSession(session);
            await loadHistory();

            // Clear form
            setPrompt('');
            setContextId('');
            setUrl('');
            // Keep mode as is (sticky preference)
            alert('Audio discussion generated successfully!');
        } catch (error) {
            console.error('Failed to generate audio:', error);
            alert('Failed to generate audio discussion. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleAudioPlayback = (sessionId: string, audioUrl: string) => {
        if (playingAudio === sessionId) {
            // Pause current audio
            audioElements[sessionId]?.pause();
            setPlayingAudio(null);
        } else {
            // Pause any currently playing audio
            if (playingAudio && audioElements[playingAudio]) {
                audioElements[playingAudio].pause();
            }

            // Play new audio
            let audio = audioElements[sessionId];
            if (!audio) {
                audio = new Audio(audioUrl);
                audio.onended = () => setPlayingAudio(null);
                setAudioElements(prev => ({ ...prev, [sessionId]: audio }));
            }
            audio.play();
            setPlayingAudio(sessionId);
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

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto space-y-10">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-400 dark:to-orange-400">
                        Listening Practice
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                        Generate audio discussions, stories, or monologues for listening practice
                    </p>
                </div>

                {/* Unified Input */}
                <div className="relative max-w-3xl mx-auto">
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
                        placeholder="Describe a topic for listening practice..."
                        // New Props
                        mode={mode}
                        onModeChange={setMode}
                        url={url}
                        onUrlChange={setUrl}
                        onSubmit={generateAudioDiscussion}
                    />


                </div>

                {/* History Section */}
                <div className="mt-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <Clock className="w-5 h-5 text-gray-400" />
                        Recent Sessions
                    </h2>

                    {history.length === 0 ? (
                        <p className="text-gray-500 italic">No history yet. Generate your first audio discussion!</p>
                    ) : (
                        <div className="space-y-4">
                            {history.map(session => (
                                <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
                                    <div
                                        onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 dark:text-white">{session.prompt}</h3>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatTime(session.createdAt)} • Duration: {formatDuration(session.durationSeconds)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {session.audioUrl && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleAudioPlayback(session.id, session.audioUrl);
                                                    }}
                                                    className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors"
                                                >
                                                    {playingAudio === session.id ? (
                                                        <Pause className="w-5 h-5" />
                                                    ) : (
                                                        <Play className="w-5 h-5" />
                                                    )}
                                                </button>
                                            )}
                                            <div className="text-gray-400">
                                                {expandedSession === session.id ? <ChevronUp /> : <ChevronDown />}
                                            </div>
                                        </div>
                                    </div>

                                    {expandedSession === session.id && (
                                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-3">Transcript</h4>
                                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                                                {session.transcript.map((line, idx) => (
                                                    <div key={idx} className="flex gap-3">
                                                        <div className="flex-shrink-0 w-24">
                                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block truncate">
                                                                {line.speaker}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 text-sm text-gray-800 dark:text-gray-200">
                                                            {line.text}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
