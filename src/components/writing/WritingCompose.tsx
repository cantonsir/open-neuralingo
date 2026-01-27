import React, { useState, useEffect } from 'react';
import { PenTool, FileText } from 'lucide-react';
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

export default function WritingCompose({ setView, setWritingData }: AppState) {
    const [topic, setTopic] = useState('');
    const [contextId, setContextId] = useState('');
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        fetchLibrary();
    }, []);

    const fetchLibrary = async () => {
        try {
            const res = await fetch('/api/library');
            if (res.ok) {
                const data = await res.json();
                setLibrary(data);
            }
        } catch (error) {
            console.error('Failed to fetch library:', error);
        }
    };

    const startSession = () => {
        if (!topic && !contextId) {
            alert("Please enter a topic or select a context.");
            return;
        }

        setWritingData({
            topic: topic || "Free Writing",
            contextId
        });
        setView('writer' as View);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto space-y-10">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Writing Studio</h1>
                    <p className="text-gray-500 dark:text-gray-400">Practice writing with AI feedback and improvements.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Input Section - Wider */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-1 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
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
                                        // Refresh library
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
                                placeholder="Describe what you want to write about, or paste your text here..."
                                className="border-none shadow-none"
                            />
                        </div>

                        <button
                            onClick={startSession}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg transition-all font-bold text-lg flex items-center justify-center gap-2"
                        >
                            <PenTool className="w-5 h-5" />
                            Start Writing
                        </button>
                    </div>

                    {/* Info / history placeholder - Narrower */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                            <h3 className="text-xl font-bold mb-2">AI Writing Coach</h3>
                            <p className="opacity-90 leading-relaxed text-sm">
                                Get instant feedback on grammar, vocabulary, and style.
                                The AI can rewrite your sentences to sound more natural and professional.
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center py-12">
                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">Past writings will appear here.</p>
                            <span className="text-xs text-gray-400">(Coming soon)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
