import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { View } from '../../types';
import { api } from '../../db';
import UnifiedInput from '../common/UnifiedInput';
import { generateReadingMaterial } from '../../services/geminiService';

interface AppState {
    setView: (view: View) => void;
    setReadingData?: (data: any) => void;
}

interface LibraryItem {
    id: string;
    title: string;
}

interface ReadingSession {
    id: string;
    prompt: string;
    title: string;
    content: string;
    createdAt: number;
}

export default function ReadingCompose({ setView, setReadingData }: AppState) {
    const [prompt, setPrompt] = useState('');
    const [contextId, setContextId] = useState('');
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [history, setHistory] = useState<ReadingSession[]>([]);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        fetch('/api/library')
            .then(res => res.json())
            .then(data => setLibrary(data))
            .catch(console.error);

        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const sessions = await api.fetchReadingSessions();
            setHistory(sessions);
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    };

    const generateReading = async () => {
        if (!prompt && !contextId) {
            alert("Please enter a prompt or select a context.");
            return;
        }

        setIsGenerating(true);
        try {
            // Get context text if contextId is provided
            let contextText = '';
            if (contextId) {
                const item = library.find(l => l.id === contextId);
                if (item) contextText = item.title;
            }

            // Generate reading material
            const material = await generateReadingMaterial(prompt || "General topic", contextText);
            
            if (!material.content || material.title === 'Error') {
                alert('Failed to generate reading material. Please try again.');
                setIsGenerating(false);
                return;
            }

            // Save session
            const session = {
                prompt: prompt || "General topic",
                title: material.title,
                content: material.content,
                contextId: contextId || undefined,
                createdAt: Date.now()
            };

            await api.saveReadingSession(session);
            await loadHistory();

            // Clear form
            setPrompt('');
            setContextId('');
            alert('Reading material generated successfully!');
        } catch (error) {
            console.error('Failed to generate reading:', error);
            alert('Failed to generate reading material. Please try again.');
        } finally {
            setIsGenerating(false);
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

    const formatTime = (ms: number) => {
        return new Date(ms).toLocaleDateString() + ' ' + new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto space-y-10">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        Reading Practice
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                        Generate engaging reading materials for comprehension practice
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
                        placeholder="What would you like to read about..."
                    />

                    {/* Generate Button */}
                    <div className="mt-6">
                        <button
                            onClick={generateReading}
                            disabled={isGenerating}
                            className="w-full p-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-3 font-medium"
                        >
                            <BookOpen className="w-5 h-5" />
                            {isGenerating ? 'Generating Content...' : 'Generate Reading Material'}
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
                        <p className="text-gray-500 italic">No history yet. Generate your first reading material!</p>
                    ) : (
                        <div className="space-y-4">
                            {history.map(session => (
                                <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div
                                        onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 dark:text-white">{session.title}</h3>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatTime(session.createdAt)} • From: "{session.prompt}"
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openReadingSession(session);
                                                }}
                                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                                title="Read full text"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                            <div className="text-gray-400">
                                                {expandedSession === session.id ? <ChevronUp /> : <ChevronDown />}
                                            </div>
                                        </div>
                                    </div>

                                    {expandedSession === session.id && (
                                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-3">Preview</h4>
                                            <div className="text-sm text-gray-800 dark:text-gray-200 max-h-64 overflow-y-auto pr-2 leading-relaxed">
                                                {session.content.substring(0, 500)}
                                                {session.content.length > 500 && '...'}
                                            </div>
                                            <button
                                                onClick={() => openReadingSession(session)}
                                                className="mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                                            >
                                                <Eye className="w-4 h-4" />
                                                Read Full Text
                                            </button>
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
