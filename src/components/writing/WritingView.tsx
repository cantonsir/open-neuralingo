import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Wand2, Loader2, Save } from 'lucide-react';
import WritingAssessment from './WritingAssessment';
import { View } from '../../types';
import { api } from '../../db';

interface WritingViewProps {
    topic: string;
    contextId?: string;
    initialContent?: string;
    onBack: (view: View) => void;
}

export default function WritingView({ topic, contextId, initialContent, onBack }: WritingViewProps) {
    const [text, setText] = useState(initialContent || '');
    const [contextContent, setContextContent] = useState('');
    const [showContext, setShowContext] = useState(!!contextId);
    const [showAssessment, setShowAssessment] = useState(false);
    const [loadingContext, setLoadingContext] = useState(!!contextId);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (contextId) {
            fetch(`/api/library/${contextId}/content`)
                .then(res => res.json())
                .then(data => {
                    setContextContent(data.content);
                    setLoadingContext(false);
                })
                .catch(err => {
                    console.error("Failed to load context", err);
                    setLoadingContext(false);
                });
        }
    }, [contextId]);

    const handleSave = async () => {
        if (!text.trim()) return;
        try {
            setIsSaving(true);
            await api.saveWritingSession({
                topic,
                content: text,
                contextId,
                createdAt: Date.now()
            });
            onBack('dashboard' as View); // Return to dashboard
        } catch (error) {
            console.error("Failed to save", error);
            alert("Failed to save writing session");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onBack('home')}
                        className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 max-w-md truncate">
                            {topic}
                        </h2>
                    </div>
                </div>

                <div className="flex gap-3">
                    {contextId && (
                        <button
                            onClick={() => setShowContext(!showContext)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${showContext ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <BookOpen className="w-4 h-4" />
                            {showContext ? 'Hide Context' : 'Show Context'}
                        </button>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={isSaving || !text.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg transition-colors font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>

                    <button
                        onClick={() => setShowAssessment(true)}
                        disabled={text.length < 10}
                        className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg transition-colors font-medium ${text.length < 10 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
                    >
                        <Wand2 className="w-4 h-4" />
                        AI Review
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Writing Area */}
                <div className="flex-1 flex flex-col p-6 md:p-10 relative">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Start writing here..."
                        className="flex-1 w-full bg-transparent resize-none border-none outline-none focus:ring-0 text-lg leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-400"
                        spellCheck={false}
                    />
                    <div className="absolute bottom-4 right-6 text-gray-400 text-xs">
                        {text.split(/\s+/).filter(w => w).length} words
                    </div>
                </div>

                {/* Context Panel */}
                {showContext && contextId && (
                    <div className="w-1/3 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto p-6 hidden md:block animate-in slide-in-from-right duration-300">
                        <h3 className="text-sm font-bold uppercase text-gray-500 mb-4 tracking-wider flex items-center gap-2">
                            <BookOpen className="w-4 h-4" /> Reference Material
                        </h3>
                        {loadingContext ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert">
                                {contextContent.split('\n').map((p, i) => (
                                    <p key={i} className="mb-2 text-gray-600 dark:text-gray-400">{p}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showAssessment && (
                <WritingAssessment
                    originalText={text}
                    topic={topic}
                    onClose={() => setShowAssessment(false)}
                />
            )}
        </div>
    );
}
