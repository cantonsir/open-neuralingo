import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, User, Bot, Loader2 } from 'lucide-react';
import { generateConversationScript, ScriptLine } from '../../services/geminiService';

interface ConversationPracticeProps {
    topic: string;
    contextId?: string;
    onBack: () => void;
}

export default function ConversationPractice({ topic, contextId, onBack }: ConversationPracticeProps) {
    const [script, setScript] = useState<ScriptLine[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadScript = async () => {
            // If contextId is present, we might want to fetch the book title/content to pass as context
            // For now just passing the ID or a placeholder indicating context usage
            const context = contextId ? `Referencing library content ID: ${contextId}` : undefined;
            const generated = await generateConversationScript(topic, context);
            setScript(generated);
            setLoading(false);
        };
        loadScript();
    }, [topic, contextId]);

    const playLine = (text: string) => {
        // Placeholder for Gemini TTS
        // For now, use browser TTS as fallback to demonstrate functionality
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        window.speechSynthesis.speak(u);
    };

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-950">
            <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 transition-colors">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Topic: {topic}
                    </h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-3xl mx-auto w-full">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                        <p className="text-gray-500">Generating conversation script...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {script.map((line, idx) => (
                            <div key={idx} className={`flex gap-4 ${line.role === 'B' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${line.role === 'A' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {line.role === 'A' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                                </div>
                                <div className={`flex-1 p-4 rounded-2xl ${line.role === 'A' ? 'bg-indigo-50 dark:bg-indigo-900/20 rounded-tl-none' : 'bg-emerald-50 dark:bg-emerald-900/20 rounded-tr-none'}`}>
                                    <p className="text-gray-900 dark:text-gray-100 text-lg leading-relaxed">{line.text}</p>
                                    <button
                                        onClick={() => playLine(line.text)}
                                        className="mt-2 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
                                    >
                                        <Play className="w-4 h-4" /> Play
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
