import React, { useState, useEffect } from 'react';
import { Mic, Clock, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { View } from '../../types';
import { api } from '../../db';
import UnifiedInput from '../common/UnifiedInput';

interface AppState {
    setView: (view: View) => void;
    setSpeakingData: (data: any) => void;
}

interface LibraryItem {
    id: string;
    title: string;
}

interface SpeakingSession {
    id: string;
    topic: string;
    transcript: { role: string; text: string }[];
    durationSeconds: number;
    createdAt: number;
}

export default function SpeakingScenario({ setView, setSpeakingData }: AppState) {
    const [topic, setTopic] = useState('');
    const [contextId, setContextId] = useState('');
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [history, setHistory] = useState<SpeakingSession[]>([]);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);



    useEffect(() => {
        fetch('/api/library')
            .then(res => res.json())
            .then(data => setLibrary(data))
            .catch(console.error);

        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const sessions = await api.fetchSpeakingSessions();
            setHistory(sessions);
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    };

    const startSession = (mode: 'live' | 'tts') => {
        if (!topic && !contextId) {
            alert("Please enter a topic or select a context.");
            return;
        }

        setSpeakingData({
            mode,
            topic: topic || "General Conversation",
            contextId
        });
        setView('conversation' as View);
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
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-600 dark:from-emerald-400 dark:to-green-400">
                        Speaking Practice
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                        What would you like to talk about today?
                    </p>
                </div>

                {/* Unified Model Input */}
                <div className="relative max-w-3xl mx-auto">
                    <UnifiedInput
                        value={topic}
                        onChange={setTopic}
                        contextId={contextId}
                        onClearContext={() => setContextId('')}
                        library={library}
                        onContextSelect={setContextId}
                        onFileUpload={async (file) => {
                            // Wrapper to match signature expected by UnifiedInput
                            // The original handleFileUpload handles the event, but we can refactor that slightly or just call the logic
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
                        themeColor="emerald"
                        placeholder="Enter a topic or attach a file to discuss..."
                    />

                    {/* Start Actions */}
                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <button
                            onClick={() => startSession('live')}
                            className="p-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-3 font-medium"
                        >
                            <Mic className="w-5 h-5" />
                            Start Live Chat
                        </button>
                        <button
                            onClick={() => startSession('tts')}
                            className="p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition-all flex items-center justify-center gap-3 font-medium"
                        >
                            <Play className="w-5 h-5" />
                            Start Roleplay
                        </button>
                    </div>
                </div>

                {/* History Section */}
                <div className="mt-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-400" />
                        Recent Sessions
                    </h2>

                    {history.length === 0 ? (
                        <p className="text-gray-500 italic">No history yet. Start a conversation!</p>
                    ) : (
                        <div className="space-y-4">
                            {history.map(session => (
                                <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div
                                        onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 dark:text-white">{session.topic}</h3>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatTime(session.createdAt)} • Duration: {formatDuration(session.durationSeconds)}
                                            </p>
                                        </div>
                                        <div className="text-gray-400">
                                            {expandedSession === session.id ? <ChevronUp /> : <ChevronDown />}
                                        </div>
                                    </div>

                                    {expandedSession === session.id && (
                                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-3">Transcript</h4>
                                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                                {session.transcript.map((msg, idx) => (
                                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user'
                                                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
                                                            : 'bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                                                            }`}>
                                                            <span className="text-xs font-bold opacity-50 block mb-1">
                                                                {msg.role === 'user' ? 'You' : 'Gemini'}
                                                            </span>
                                                            {msg.text}
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
