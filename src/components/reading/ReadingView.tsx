import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Loader2, BrainCircuit } from 'lucide-react';
import { View } from '../../types';
import ReadingAssessment from './ReadingAssessment';

interface ReadingViewProps {
    libraryId: string;
    title: string;
    onNavigate: (view: View) => void;
}

export default function ReadingView({ libraryId, title, onNavigate }: ReadingViewProps) {
    const [content, setContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [showAssessment, setShowAssessment] = useState(false);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await fetch(`/api/library/${libraryId}/content`);
                if (res.ok) {
                    const data = await res.json();
                    setContent(data.content);
                }
            } catch (error) {
                console.error('Failed to fetch content:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (libraryId) {
            fetchContent();
        }
    }, [libraryId]);

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 relative">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 transition-colors">
                <button
                    onClick={() => onNavigate('home')}
                    className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                        {title}
                    </h2>
                </div>
                <button
                    onClick={() => setShowAssessment(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg transition-colors font-medium text-sm"
                >
                    <BrainCircuit className="w-4 h-4" />
                    Take Quiz
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-16">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto prose dark:prose-invert prose-lg prose-indigo focus:outline-none">
                        {content ? (
                            content.split('\n').map((paragraph, idx) => (
                                <p key={idx} className="mb-4 leading-relaxed text-gray-800 dark:text-gray-300">
                                    {paragraph}
                                </p>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 italic">No text content available.</p>
                        )}
                    </div>
                )}
            </div>

            {showAssessment && (
                <ReadingAssessment
                    text={content}
                    onClose={() => setShowAssessment(false)}
                />
            )}
        </div>
    );
}
