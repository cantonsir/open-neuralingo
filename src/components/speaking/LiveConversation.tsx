import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic, MicOff, Volume2, MessageSquare, X } from 'lucide-react';
import { GeminiLiveService } from '../../services/geminiLiveService';
import { api } from '../../db';

interface LiveConversationProps {
    topic: string;
    contextId?: string;
    onBack: () => void;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export default function LiveConversation({ topic, contextId, onBack }: LiveConversationProps) {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState('Ready');
    const [audioLevel, setAudioLevel] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);
    const [transcript, setTranscript] = useState<ChatMessage[]>([]);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Service ref
    const serviceRef = useRef<GeminiLiveService | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        serviceRef.current = new GeminiLiveService({
            onStatusChange: (s) => {
                if (s === 'disconnected') {
                    setIsActive(false);
                    setStatus('Ready');
                } else if (s === 'connecting') {
                    setStatus('Connecting to Gemini Live...');
                } else if (s === 'listening') {
                    setStatus('Listening...');
                } else if (s === 'speaking') {
                    setStatus('Gemini is speaking...');
                }
            },
            onAudioLevel: (level) => {
                setAudioLevel(level);
            },
            onTranscriptUpdate: (text, isUser) => {
                setTranscript(prev => [...prev, { role: isUser ? 'user' : 'model', text }]);
            }
        });

        return () => {
            serviceRef.current?.endSession();
        };
    }, []);

    useEffect(() => {
        if (transcriptEndRef.current) {
            transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcript, showTranscript]);

    const handleEndSession = async () => {
        if (!isActive) return;

        serviceRef.current?.endSession();
        setIsActive(false);
        setStatus('Ready');

        if (startTime && transcript.length > 0) {
            const durationSeconds = Math.round((Date.now() - startTime) / 1000);
            try {
                await api.saveSpeakingSession({
                    topic,
                    transcript,
                    durationSeconds,
                    createdAt: startTime
                });
            } catch (error) {
                console.error("Failed to save session:", error);
            }
        }
        setStartTime(null);
    };

    const toggleSession = () => {
        if (isActive) {
            handleEndSession();
        } else {
            setIsActive(true);
            setTranscript([]); // Clear previous transcript
            setStartTime(Date.now());
            serviceRef.current?.startSession(topic, contextId);
        }
    };

    // Temporary mock for user speaking (since we don't have STT yet in simulator)
    const handleMockUserSpeak = () => {
        if (status === 'Listening...') {
            const mockInputs = [
                "That sounds good.",
                "I agree with you.",
                "Can you tell me more?",
                "This is a really interesting topic.",
                "I'm not sure about that."
            ];
            const randomInput = mockInputs[Math.floor(Math.random() * mockInputs.length)];
            serviceRef.current?.sendUserMessage(randomInput);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-950 text-white relative">
            <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
                <button
                    onClick={async () => {
                        await handleEndSession();
                        onBack();
                    }}
                    className="p-2 -ml-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></span>
                        Live: {topic}
                    </h2>
                </div>
                <button
                    onClick={() => setShowTranscript(!showTranscript)}
                    className={`p-2 rounded-full transition-colors ${showTranscript ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    title="Toggle Transcript"
                >
                    <MessageSquare className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
                {/* Visualizer Background */}
                {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                        <div
                            className="w-64 h-64 bg-blue-500 rounded-full blur-[100px] transition-transform duration-100"
                            style={{ transform: `scale(${1 + audioLevel / 50})` }}
                        ></div>
                    </div>
                )}

                {/* Main Orb */}
                <div className={`relative z-10 transition-all duration-700 ${isActive ? 'scale-110' : 'scale-100 grayscale'}`}>
                    <div
                        className="w-48 h-48 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-transform duration-100"
                        style={{ transform: `scale(${1 + audioLevel / 100})` }}
                        onClick={handleMockUserSpeak} // Hidden trigger for testing
                    >
                        <div className="text-4xl text-white drop-shadow-lg">
                            {isActive ? <Volume2 className="w-16 h-16" /> : <MicOff className="w-16 h-16 opacity-50" />}
                        </div>
                    </div>
                </div>

                {/* Status Text */}
                <div className="absolute bottom-32 text-center">
                    <p className="text-2xl font-light tracking-wide text-gray-300 animate-pulse">
                        {status}
                    </p>
                    {isActive && status === 'Listening...' && (
                        <p className="text-sm text-gray-500 mt-2">(Tap orb to simulate speaking)</p>
                    )}
                </div>

                {/* Start/End Button */}
                <div className="absolute bottom-12">
                    <button
                        onClick={toggleSession}
                        className={`px-8 py-4 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-white text-gray-900 hover:bg-gray-200'}`}
                    >
                        {isActive ? 'End Session' : 'Start Conversation'}
                    </button>
                </div>

                {/* Transcript Overlay */}
                {showTranscript && (
                    <div className="absolute top-4 right-4 w-80 max-h-[60%] bg-gray-900/90 backdrop-blur border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-20">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Transcript</h3>
                            <button onClick={() => setShowTranscript(false)} className="text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {transcript.length === 0 ? (
                                <p className="text-center text-gray-600 italic text-sm">Conversation started...</p>
                            ) : (
                                transcript.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-sm'
                                            : 'bg-gray-800 text-gray-200 rounded-tl-sm'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={transcriptEndRef} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
