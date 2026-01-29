import React from 'react';
import { User, Sparkles } from 'lucide-react';
import { ListeningSession } from '../../types';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    text?: string;
    session?: ListeningSession | null;
    isTyping?: boolean;
    // For rendering the session card content
    renderSessionCard?: (session: ListeningSession) => React.ReactNode;
}

export default function MessageBubble({ role, text, session, isTyping, renderSessionCard }: MessageBubbleProps) {
    const isUser = role === 'user';

    if (isTyping) {
        return (
            <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`flex max-w-[80%] md:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                        <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    {/* Bubble */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex gap-1.5 pt-1">
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 group animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${isUser
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                        : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                    }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Bubble Content */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>

                    {/* Text Bubble */}
                    {text && (
                        <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-base leading-relaxed break-words whitespace-pre-wrap ${isUser
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                            }`}>
                            {text}
                        </div>
                    )}

                    {/* Rich Content (Session Card) */}
                    {session && renderSessionCard && (
                        <div className="mt-2 w-full min-w-[300px]">
                            {renderSessionCard(session)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
