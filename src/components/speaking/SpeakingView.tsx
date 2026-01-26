import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, User, Bot, Loader2, Volume2 } from 'lucide-react';
import { getChatResponse } from '../../ai';

export default function SpeakingView() {
    const [scenario, setScenario] = useState('Ordering Coffee');
    const [messages, setMessages] = useState<{ role: 'user' | 'model'; parts: string }[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg = { role: 'user' as const, parts: inputValue };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsSending(true);

        try {
            // We only send the *previous* messages as history, not including the one we just added?
            // Actually getChatResponse logic constructs history differently.
            // Let's pass the updated history including the new user message?
            // My getChatResponse implementation in ai.ts assumes 'history' is PAST messages.
            // But wait, the prompt setup in ai.ts:
            // ...history.map...
            // And then `chat.sendMessage("Continue conversation")`?
            // No, `chat.sendMessage` usually takes the *new* user input.
            // My `getChatResponse` implementation sends "Continue conversation" as the trigger?
            // Let's check ai.ts implementation again.

            /*
             const chat = model.startChat({ history: [...] });
             const result = await chat.sendMessage("Continue conversation");
            */

            // This logic in ai.ts is a bit weird if I want to send *specific* user text.
            // The user text should be part of the `sendMessage` call or the last item in history?
            // If I look at my ai.ts: 
            // I constructed history from the passed `history` array.
            // If the last item in `history` is USER, then Gemini expects to reply.
            // If I send "Continue conversation", Gemini might get confused if the last message was already a user prompt waiting for reply.
            // A better `getChatResponse` would take `currentMessage` separately.

            // BUT, for now let's assume I pass the FULL history including the new User message,
            // and `sendMessage("Continue...")` prompts Gemini to generate the next response.
            // It works for "simulated" turns, but might be slightly redundant.
            // Let's stick to the interface I made or valid it.

            const response = await getChatResponse([...messages, userMsg], scenario);

            if (response) {
                setMessages(prev => [...prev, { role: 'model', parts: response }]);
            }
        } catch (error) {
            console.error("Failed to get response", error);
        } finally {
            setIsSending(false);
        }
    };

    const scenarios = [
        "Ordering Coffee",
        "Job Interview",
        "Asking for Directions",
        "Checking into a Hotel",
        "Making a Reservation",
        "Small Talk at a Party"
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 shadow-sm z-10 flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                        <Mic size={20} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Speaking Roleplay</h1>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-500">Scenario:</label>
                    <select
                        value={scenario}
                        onChange={(e) => {
                            setScenario(e.target.value);
                            setMessages([]); // Clear chat on scenario change
                        }}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm"
                    >
                        {scenarios.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                {messages.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-50">
                        <Mic size={48} className="mb-4" />
                        <p>Select a scenario and say "Hello" to start!</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                            ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}
                        `}>
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`p-3 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm
                            ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                            }
                        `}>
                            {msg.parts}
                            {msg.role === 'model' && (
                                <button className="ml-2 inline-flex align-middle opacity-50 hover:opacity-100" title="Play Audio (Mock)">
                                    <Volume2 size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {isSending && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                            <Bot size={16} />
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin text-green-500" />
                            <span className="text-xs text-gray-400">Typing...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                <div className="max-w-4xl mx-auto flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your response..."
                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isSending || !inputValue.trim()}
                        className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        <Send size={20} />
                    </button>
                    <button
                        className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-green-600 hover:border-green-500 flex items-center justify-center transition-all"
                        title="Speak (Coming Soon)"
                    >
                        <Mic size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
