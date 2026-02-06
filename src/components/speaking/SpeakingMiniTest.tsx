import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Mic, MicOff, Square, MessageCircle, ArrowRight, Check, Volume2 } from 'lucide-react';
import { SpeakingProfileData } from './SpeakingProfile';
import { TranslationPrompt, generateSpeakingTestPrompts, generateChatResponse } from '../../services/geminiService';
import { useSpeakingTest, SpeakingTestResponse } from '../../hooks/useSpeakingTest';

interface SpeakingMiniTestProps {
    profile: SpeakingProfileData;
    onComplete: (response: SpeakingTestResponse, prompts: TranslationPrompt[]) => void;
    onBack?: () => void;
}

const MAX_CONVERSATION_TURNS = 6;

const SpeakingMiniTest: React.FC<SpeakingMiniTestProps> = ({ profile, onComplete, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [prompts, setPrompts] = useState<TranslationPrompt[]>([]);
    const [conversationTopic, setConversationTopic] = useState('');
    const [aiThinking, setAiThinking] = useState(false);
    const [showTransition, setShowTransition] = useState(false);

    const {
        currentPhase,
        setCurrentPhase,
        currentPromptIndex,
        currentPrompt,
        totalPrompts,
        translationResponses,
        conversationExchanges,
        isRecording,
        currentTranscript,
        interimTranscript,
        setCurrentTranscript,
        startRecording,
        stopRecording,
        saveTranslationResponse,
        handleNextPrompt,
        handlePreviousPrompt,
        addConversationExchange,
        handleCompleteTest,
        skipPartB,
    } = useSpeakingTest({ prompts, onComplete });

    // Load prompts on mount
    useEffect(() => {
        const loadPrompts = async () => {
            setLoading(true);
            try {
                const generatedPrompts = await generateSpeakingTestPrompts(
                    profile,
                    profile.firstLanguage,
                    8
                );
                setPrompts(generatedPrompts);

                // Set conversation topic based on profile
                const contexts = profile.contextPreferences;
                const topic = contexts.length > 0
                    ? `Having a ${contexts[Math.floor(Math.random() * contexts.length)]} conversation`
                    : 'Having a casual conversation';
                setConversationTopic(topic);
            } catch (error) {
                console.error('Error generating prompts:', error);
            }
            setLoading(false);
        };

        loadPrompts();
    }, [profile]);

    // Handle transition from Part A to Part B
    const handleStartPartB = useCallback(() => {
        setShowTransition(false);
        setCurrentPhase('partB');
        setCurrentTranscript(''); // Clear any previous transcript

        // Generate initial AI message
        const initConversation = async () => {
            setAiThinking(true);
            try {
                const initialMessage = await generateChatResponse(
                    [],
                    `Start a friendly conversation about: ${conversationTopic}. Keep your response short (1-2 sentences). Ask the learner a question.`
                );
                addConversationExchange('ai', initialMessage);
            } catch (error) {
                console.error('Error generating initial conversation message:', error);
                addConversationExchange('ai', `Hi! Let's have a conversation about ${conversationTopic}. How are you doing today?`);
            }
            setAiThinking(false);
        };

        initConversation();
    }, [conversationTopic, setCurrentPhase, setCurrentTranscript, addConversationExchange]);

    // Handle Part A -> Part B transition
    const handlePartAComplete = useCallback(() => {
        if (currentTranscript) {
            saveTranslationResponse(currentTranscript);
        }
        setShowTransition(true);
    }, [currentTranscript, saveTranslationResponse]);

    // Handle conversation turn
    const handleSendConversationTurn = useCallback(async () => {
        if (!currentTranscript.trim()) return;

        const userText = currentTranscript.trim();
        addConversationExchange('user', userText);
        setCurrentTranscript('');

        const userTurns = conversationExchanges.filter(e => e.role === 'user').length + 1;

        if (userTurns >= MAX_CONVERSATION_TURNS) {
            // Conversation complete
            setTimeout(() => handleCompleteTest(), 500);
            return;
        }

        // Get AI response
        setAiThinking(true);
        try {
            const history = [...conversationExchanges, { role: 'user' as const, text: userText, timestamp: Date.now() }]
                .map(e => ({ role: e.role === 'ai' ? 'assistant' : 'user', text: e.text }));

            const aiResponse = await generateChatResponse(
                history,
                `Continue the conversation about: ${conversationTopic}. Keep responses short (1-2 sentences). Ask a follow-up question to keep the conversation going.`
            );
            addConversationExchange('ai', aiResponse);
        } catch (error) {
            addConversationExchange('ai', "That's interesting! Tell me more about that.");
        }
        setAiThinking(false);
    }, [currentTranscript, conversationExchanges, conversationTopic, addConversationExchange, setCurrentTranscript, handleCompleteTest]);

    // Toggle recording
    const handleToggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording(profile.targetLanguage);
        }
    }, [isRecording, stopRecording, startRecording, profile.targetLanguage]);

    // Handle next in Part A
    const handleNext = useCallback(() => {
        if (currentPromptIndex >= totalPrompts - 1) {
            handlePartAComplete();
        } else {
            handleNextPrompt();
        }
    }, [currentPromptIndex, totalPrompts, handlePartAComplete, handleNextPrompt]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Generating personalized prompts...</p>
                </div>
            </div>
        );
    }

    // Transition screen between Part A and Part B
    if (showTransition) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MessageCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        Great job with the translations!
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        Now let's have a short conversation to test your spontaneous speaking ability.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={skipPartB}
                            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                        >
                            Skip Conversation
                        </button>
                        <button
                            onClick={handleStartPartB}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                        >
                            Start Conversation
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Part A: Oral Translation
    if (currentPhase === 'partA') {
        const currentScenario = currentPrompt?.scenario || 'General';
        const completedCount = translationResponses.length;

        return (
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Mic className="w-5 h-5 text-green-600" />
                            Part A: Oral Translation
                        </h2>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Prompt {currentPromptIndex + 1} of {totalPrompts}
                        </div>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-600 transition-all duration-300"
                            style={{ width: `${((currentPromptIndex + 1) / totalPrompts) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Prompt area */}
                    <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
                        <div className="max-w-2xl w-full text-center">
                            {/* Scenario badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium mb-6">
                                {currentScenario}
                                <span className="text-xs opacity-70">Difficulty {currentPrompt?.difficulty || 1}/5</span>
                            </div>

                            {/* Source text */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-8">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                    Translate this to your target language:
                                </p>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white leading-relaxed">
                                    {currentPrompt?.sourceText || ''}
                                </p>
                            </div>

                            {/* Record button */}
                            <button
                                onClick={handleToggleRecording}
                                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all mx-auto mb-6 ${
                                    isRecording
                                        ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-500/30'
                                        : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30'
                                }`}
                            >
                                {isRecording ? (
                                    <Square className="w-8 h-8 text-white" />
                                ) : (
                                    <Mic className="w-8 h-8 text-white" />
                                )}
                            </button>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
                            </p>

                            {/* Transcript display */}
                            {(currentTranscript || interimTranscript) && (
                                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-left">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Your response:</p>
                                    <p className="text-gray-900 dark:text-white">
                                        {currentTranscript}
                                        {interimTranscript && (
                                            <span className="text-gray-400 italic">{interimTranscript}</span>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - completed responses */}
                    <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Completed ({completedCount}/{totalPrompts})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {prompts.map((prompt, idx) => {
                                const response = translationResponses.find(r => r.promptId === prompt.id);
                                const isCurrent = idx === currentPromptIndex;
                                return (
                                    <div
                                        key={prompt.id}
                                        className={`p-3 rounded-lg text-sm ${
                                            isCurrent
                                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                                : response
                                                    ? 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                                                    : 'bg-gray-50 dark:bg-gray-900 opacity-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            {response ? (
                                                <Check className="w-4 h-4 text-green-600" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                                            )}
                                            <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                                                {prompt.scenario}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate pl-6">
                                            {prompt.sourceText.substring(0, 40)}...
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer navigation */}
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={onBack || handlePreviousPrompt}
                            disabled={currentPromptIndex === 0 && !onBack}
                            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            {currentPromptIndex === 0 ? 'Back' : 'Previous'}
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={!currentTranscript && !translationResponses.find(r => r.promptId === currentPrompt?.id)}
                            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            {currentPromptIndex < totalPrompts - 1 ? (
                                <>
                                    Next Prompt
                                    <ChevronRight className="w-5 h-5" />
                                </>
                            ) : (
                                'Continue to Conversation'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Part B: AI Conversation
    if (currentPhase === 'partB') {
        const userTurns = conversationExchanges.filter(e => e.role === 'user').length;
        const remainingTurns = MAX_CONVERSATION_TURNS - userTurns;

        return (
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-green-600" />
                            Part B: Conversation
                        </h2>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {remainingTurns > 0 ? `${remainingTurns} turns remaining` : 'Final turn'}
                        </div>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-600 transition-all duration-300"
                            style={{ width: `${(userTurns / MAX_CONVERSATION_TURNS) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Topic banner */}
                <div className="px-6 py-3 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-800 dark:text-green-200">
                        <strong>Topic:</strong> {conversationTopic}
                    </p>
                </div>

                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {conversationExchanges.map((exchange, idx) => (
                        <div
                            key={idx}
                            className={`flex ${exchange.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-md px-4 py-3 rounded-2xl ${
                                    exchange.role === 'user'
                                        ? 'bg-green-600 text-white rounded-br-sm'
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-sm'
                                }`}
                            >
                                <p className="text-sm">{exchange.text}</p>
                            </div>
                        </div>
                    ))}

                    {aiThinking && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input area */}
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleToggleRecording}
                            disabled={aiThinking}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                                isRecording
                                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                                    : 'bg-green-600 hover:bg-green-700'
                            } disabled:opacity-50`}
                        >
                            {isRecording ? (
                                <MicOff className="w-5 h-5 text-white" />
                            ) : (
                                <Mic className="w-5 h-5 text-white" />
                            )}
                        </button>

                        <div className="flex-1 relative">
                            {isRecording && interimTranscript && (
                                <div className="absolute -top-8 left-0 right-0 px-4 py-1 bg-green-50 dark:bg-green-900/20 rounded-t-lg border-x border-t border-green-200 dark:border-green-800">
                                    <p className="text-sm text-green-700 dark:text-green-300 italic">
                                        {interimTranscript}...
                                    </p>
                                </div>
                            )}
                            <input
                                type="text"
                                value={currentTranscript}
                                onChange={(e) => setCurrentTranscript(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendConversationTurn()}
                                placeholder="Speak or type your response..."
                                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-600 focus:border-transparent"
                                disabled={aiThinking}
                            />
                        </div>

                        <button
                            onClick={handleSendConversationTurn}
                            disabled={!currentTranscript.trim() || aiThinking}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            Send
                        </button>

                        {remainingTurns <= 1 && (
                            <button
                                onClick={handleCompleteTest}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                            >
                                Finish
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Complete state (shouldn't normally be visible)
    return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Processing results...</p>
            </div>
        </div>
    );
};

export default SpeakingMiniTest;
