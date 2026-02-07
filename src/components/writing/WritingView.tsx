import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    Eye,
    Loader2,
    Save,
    Send,
    SpellCheck,
    Wand2,
    X,
} from 'lucide-react';
import WritingAssessment from './WritingAssessment';
import { GrammarError, View } from '../../types';
import { api } from '../../db';
import { analyzeGrammarErrors, chatWithGrammarTutor } from '../../services/geminiService';
import { useTargetLanguage } from '../../hooks/useTargetLanguage';

interface WritingViewProps {
    sessionId?: string;
    topic: string;
    contextId?: string;
    initialContent?: string;
    onBack: (view: View) => void;
}

interface CoachMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
}

const isResolved = (error: GrammarError) => error.status === 'completed' || error.status === 'revealed';

export default function WritingView({ sessionId, topic, contextId, initialContent, onBack }: WritingViewProps) {
    const { targetLanguage } = useTargetLanguage();

    const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId);
    const [text, setText] = useState(initialContent || '');
    const [contextContent, setContextContent] = useState('');
    const [showContext, setShowContext] = useState(!!contextId);
    const [showAssessment, setShowAssessment] = useState(false);
    const [loadingContext, setLoadingContext] = useState(!!contextId);
    const [isSaving, setIsSaving] = useState(false);

    const [showGrammarCoach, setShowGrammarCoach] = useState(false);
    const [coachAnalyzing, setCoachAnalyzing] = useState(false);
    const [coachBusy, setCoachBusy] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [hasAnalyzedCoach, setHasAnalyzedCoach] = useState(false);
    const [coachErrors, setCoachErrors] = useState<GrammarError[]>([]);
    const [activeCoachIndex, setActiveCoachIndex] = useState(0);
    const [coachThreads, setCoachThreads] = useState<Record<number, CoachMessage[]>>({});
    const [revealedSentenceMap, setRevealedSentenceMap] = useState<Record<number, boolean>>({});
    const [coachInput, setCoachInput] = useState('');

    const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const activeCoachError = coachErrors[activeCoachIndex];
    const activeThread = activeCoachError ? (coachThreads[activeCoachError.id] || []) : [];

    const resolvedCount = useMemo(() => coachErrors.filter(isResolved).length, [coachErrors]);
    const canMoveNext = Boolean(activeCoachError && isResolved(activeCoachError));

    useEffect(() => {
        if (!contextId) {
            setLoadingContext(false);
            return;
        }

        fetch(`/api/library/${contextId}/content`)
            .then(res => res.json())
            .then(data => {
                setContextContent(data.content);
                setLoadingContext(false);
            })
            .catch(error => {
                console.error('Failed to load context', error);
                setLoadingContext(false);
            });
    }, [contextId]);

    const handleSave = async () => {
        if (!text.trim()) return;

        try {
            setIsSaving(true);
            const saved = await api.saveWritingSession({
                id: currentSessionId,
                topic,
                content: text,
                contextId,
                createdAt: Date.now(),
            });
            setCurrentSessionId(saved.id);
            onBack('compose' as View);
        } catch (error) {
            console.error('Failed to save', error);
            const message = error instanceof Error ? error.message : 'Failed to save writing session';
            alert(`Failed to save writing session: ${message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const buildStarterMessage = (error: GrammarError, total: number) => {
        return `I found ${total} problem sentence${total > 1 ? 's' : ''}.\n\nStart with:\n"${error.originalSentence}"\n\n${error.hintLevel1}\n\nType your corrected sentence below.`;
    };

    const ensureThreadInitialized = (error: GrammarError, total: number, customMessage?: string) => {
        setCoachThreads(prev => {
            if (prev[error.id]?.length) {
                return prev;
            }

            return {
                ...prev,
                [error.id]: [{
                    id: createId('ai'),
                    role: 'assistant',
                    text: customMessage || buildStarterMessage(error, total),
                }],
            };
        });
    };

    const startGrammarCoach = async () => {
        if (text.trim().length < 10) return;

        setShowGrammarCoach(true);
        setShowContext(false);
        setCoachAnalyzing(true);
        setCoachBusy(false);
        setHasAnalyzedCoach(false);
        setAnalysisError(null);
        setCoachInput('');

        try {
            const detected = await analyzeGrammarErrors(text, targetLanguage);
            const normalized = detected.map((item, index) => ({
                ...item,
                id: index,
                status: 'pending' as const,
                attempts: 0,
                currentHintLevel: index === 0 ? 1 : 0,
            }));

            setCoachErrors(normalized);
            setActiveCoachIndex(0);
            setRevealedSentenceMap({});
            setHasAnalyzedCoach(true);

            if (normalized.length === 0) {
                setCoachThreads({});
                return;
            }

            setCoachThreads({
                [normalized[0].id]: [{
                    id: createId('ai'),
                    role: 'assistant',
                    text: buildStarterMessage(normalized[0], normalized.length),
                }],
            });
        } catch (error) {
            console.error('Failed to start grammar coach', error);
            setCoachErrors([]);
            setCoachThreads({});
            setHasAnalyzedCoach(true);
            setAnalysisError('I could not analyze grammar right now. Please try again.');
        } finally {
            setCoachAnalyzing(false);
        }
    };

    const sendCoachText = async (userText: string) => {
        const trimmed = userText.trim();
        if (!trimmed || coachBusy) return;

        const currentError = coachErrors[activeCoachIndex];
        if (!currentError) return;

        const errorId = currentError.id;
        const existingThread = coachThreads[errorId] || [];
        const userMessage: CoachMessage = {
            id: createId('user'),
            role: 'user',
            text: trimmed,
        };
        const nextThread = [...existingThread, userMessage];

        setCoachThreads(prev => ({
            ...prev,
            [errorId]: nextThread,
        }));

        setCoachBusy(true);
        try {
            const reply = await chatWithGrammarTutor(
                nextThread.map(message => ({ role: message.role, text: message.text })),
                currentError,
                targetLanguage
            );

            const isCorrect = /\[CORRECT\]/i.test(reply);
            const isRevealed = /\[REVEALED\]/i.test(reply);
            const isQuestion = /\[QUESTION\]/i.test(reply);
            const isAttempt = /\[ATTEMPT\]/i.test(reply);
            const shouldCountAsAttempt = isAttempt || (!isQuestion && !isCorrect && !isRevealed);

            const cleanReply = reply
                .replace(/\[(CORRECT|REVEALED|QUESTION|ATTEMPT)\]/gi, '')
                .trim();

            setCoachThreads(prev => ({
                ...prev,
                [errorId]: [
                    ...(prev[errorId] || nextThread),
                    {
                        id: createId('ai'),
                        role: 'assistant',
                        text: cleanReply || 'Please try one more correction attempt.',
                    },
                ],
            }));

            setCoachErrors(prev => {
                const updated = [...prev];
                const index = updated.findIndex(item => item.id === errorId);
                if (index === -1) return prev;

                const current = { ...updated[index] };
                if (shouldCountAsAttempt) {
                    current.attempts += 1;
                }

                if (isCorrect) {
                    current.status = 'completed';
                } else if (isRevealed) {
                    current.status = 'revealed';
                } else if (shouldCountAsAttempt && current.currentHintLevel < 3) {
                    current.currentHintLevel += 1;
                }

                updated[index] = current;
                return updated;
            });

            if (isRevealed) {
                setRevealedSentenceMap(prev => ({ ...prev, [errorId]: true }));
            }
        } catch (error) {
            console.error('Coach chat error', error);
            setCoachThreads(prev => ({
                ...prev,
                [errorId]: [
                    ...(prev[errorId] || nextThread),
                    {
                        id: createId('ai'),
                        role: 'assistant',
                        text: 'Connection issue. Please try your correction again.',
                    },
                ],
            }));
        } finally {
            setCoachBusy(false);
        }
    };

    const sendCoachMessage = async () => {
        const userText = coachInput.trim();
        if (!userText) return;

        setCoachInput('');
        await sendCoachText(userText);
    };

    const sendPresetCoachQuestion = async (prompt: string) => {
        if (coachBusy || coachAnalyzing) return;
        await sendCoachText(prompt);
    };

    const revealCorrectedSentence = () => {
        const currentError = coachErrors[activeCoachIndex];
        if (!currentError) return;
        if (revealedSentenceMap[currentError.id]) return;

        setRevealedSentenceMap(prev => ({ ...prev, [currentError.id]: true }));

        setCoachErrors(prev => {
            const updated = [...prev];
            const index = updated.findIndex(item => item.id === currentError.id);
            if (index === -1) return prev;

            const next = { ...updated[index] };
            if (next.status !== 'completed') {
                next.status = 'revealed';
            }
            updated[index] = next;
            return updated;
        });

        setCoachThreads(prev => ({
            ...prev,
            [currentError.id]: [
                ...(prev[currentError.id] || []),
                {
                    id: createId('ai'),
                    role: 'assistant',
                    text: `Corrected sentence:\n"${currentError.correctedSentence}"\n\nWhy: ${currentError.hintLevel2}`,
                },
            ],
        }));
    };

    const selectCoachError = (index: number) => {
        setActiveCoachIndex(index);

        setCoachErrors(prev => {
            const updated = [...prev];
            const selected = updated[index];
            if (!selected) return prev;

            if (selected.currentHintLevel === 0) {
                updated[index] = { ...selected, currentHintLevel: 1 };
            }

            return updated;
        });

        const selected = coachErrors[index];
        if (selected) {
            ensureThreadInitialized(
                selected.currentHintLevel === 0 ? { ...selected, currentHintLevel: 1 } : selected,
                coachErrors.length,
                `Work on this sentence:\n"${selected.originalSentence}"\n\n${selected.currentHintLevel >= 2 ? selected.hintLevel2 : selected.hintLevel1}`
            );
        }
    };

    const goNextCoachError = () => {
        if (!coachErrors.length) return;

        const unresolvedIndices = coachErrors
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => !isResolved(item))
            .map(({ index }) => index);

        if (!unresolvedIndices.length) return;

        let nextIndex = unresolvedIndices.find(index => index > activeCoachIndex);
        if (nextIndex === undefined) {
            nextIndex = unresolvedIndices[0];
        }

        const nextError = coachErrors[nextIndex];
        setActiveCoachIndex(nextIndex);
        ensureThreadInitialized(nextError, coachErrors.length);
    };

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onBack('compose')}
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
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${showContext
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300'
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
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
                        onClick={startGrammarCoach}
                        disabled={text.length < 10 || coachAnalyzing}
                        className={`flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg transition-colors font-medium ${text.length < 10 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
                    >
                        <SpellCheck className="w-4 h-4" />
                        {coachAnalyzing ? 'Analyzing...' : 'Grammar Coach'}
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
                <div className="flex-1 flex flex-col p-6 md:p-10 relative">
                    <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder="Start writing here..."
                        className="flex-1 w-full bg-transparent resize-none border-none outline-none focus:ring-0 text-lg leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-400"
                        spellCheck={false}
                    />
                    <div className="absolute bottom-4 right-6 text-gray-400 text-xs">
                        {text.split(/\s+/).filter(word => word).length} words
                    </div>
                </div>

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
                                {contextContent.split('\n').map((paragraph, index) => (
                                    <p key={index} className="mb-2 text-gray-600 dark:text-gray-400">{paragraph}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {showGrammarCoach && (
                    <div className="w-[780px] border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex">
                        <div className="w-[340px] border-r border-gray-200 dark:border-gray-800 flex flex-col">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-sm text-purple-600">Grammar Coach</h3>
                                    <p className="text-xs text-gray-500">
                                        {coachErrors.length ? `${resolvedCount}/${coachErrors.length} resolved` : 'Sentence workspace'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowGrammarCoach(false)}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {coachAnalyzing ? (
                                <div className="flex-1 flex items-center justify-center gap-2 text-sm text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Analyzing problem sentences...
                                </div>
                            ) : analysisError ? (
                                <div className="p-4 space-y-3">
                                    <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                        {analysisError}
                                    </div>
                                    <button
                                        onClick={startGrammarCoach}
                                        className="w-full px-3 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
                                    >
                                        Retry Analysis
                                    </button>
                                </div>
                            ) : hasAnalyzedCoach && coachErrors.length === 0 ? (
                                <div className="p-4 text-sm text-gray-500">No grammar issues detected for this draft.</div>
                            ) : (
                                <>
                                    <div className="p-3 border-b border-gray-200 dark:border-gray-800 max-h-56 overflow-y-auto space-y-2">
                                        {coachErrors.map((error, index) => {
                                            const selected = index === activeCoachIndex;
                                            const revealed = Boolean(revealedSentenceMap[error.id]);
                                            const statusLabel = error.status === 'completed'
                                                ? 'Fixed'
                                                : error.status === 'revealed' || revealed
                                                    ? 'Revealed'
                                                    : 'Pending';

                                            return (
                                                <button
                                                    key={error.id}
                                                    onClick={() => selectCoachError(index)}
                                                    className={`w-full text-left p-2 rounded-lg border transition-colors ${selected
                                                        ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/20'
                                                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 text-xs font-semibold">
                                                            {error.status === 'completed' ? (
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                            ) : error.status === 'revealed' || revealed ? (
                                                                <Eye className="w-3.5 h-3.5 text-amber-500" />
                                                            ) : (
                                                                <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                                                            )}
                                                            <span className="capitalize text-gray-700 dark:text-gray-200">{error.errorType}</span>
                                                        </div>
                                                        <span className="text-[10px] uppercase tracking-wide text-gray-500">{statusLabel}</span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{error.originalSentence}</p>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {activeCoachError && (
                                        <div className="px-3 py-3 flex-1 overflow-y-auto space-y-3">
                                            <div>
                                                <h4 className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">Selected Sentence</h4>
                                                <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5">
                                                    {activeCoachError.originalSentence}
                                                </p>

                                                {(revealedSentenceMap[activeCoachError.id] || activeCoachError.status === 'revealed') && (
                                                    <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2.5">
                                                        <p className="text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300 font-semibold mb-1">Corrected Sentence</p>
                                                        <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">{activeCoachError.correctedSentence}</p>
                                                    </div>
                                                )}

                                                <p className="text-[11px] text-gray-500 mt-2">
                                                    Attempts: {activeCoachError.attempts} • Hint level: {Math.max(activeCoachError.currentHintLevel, 1)}/3
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => sendPresetCoachQuestion('Please explain the grammar rule and what to check in this sentence.')}
                                                    disabled={coachBusy}
                                                    className="text-xs px-2 py-2 rounded border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                                                >
                                                    Explain Rule
                                                </button>
                                                <button
                                                    onClick={() => sendPresetCoachQuestion('Give me a similar example sentence so I can learn the pattern.')}
                                                    disabled={coachBusy}
                                                    className="text-xs px-2 py-2 rounded border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                                                >
                                                    Similar Example
                                                </button>
                                                <button
                                                    onClick={revealCorrectedSentence}
                                                    disabled={coachBusy || Boolean(revealedSentenceMap[activeCoachError.id])}
                                                    className="text-xs px-2 py-2 rounded border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                                                >
                                                    Show Corrected
                                                </button>
                                            </div>

                                            <p className="text-[11px] text-gray-500">
                                                Edit in your draft manually, then submit your correction in the discussion panel.
                                            </p>

                                            <button
                                                onClick={goNextCoachError}
                                                disabled={!canMoveNext}
                                                className="w-full flex items-center justify-center gap-1 text-xs px-3 py-2 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next Sentence
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Discussion</h4>
                                <p className="text-xs text-gray-500">
                                    {activeCoachError
                                        ? `Sentence ${activeCoachIndex + 1} • ${activeCoachError.errorType}`
                                        : 'Select a sentence to discuss'}
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {activeThread.length === 0 ? (
                                    <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                        Ask a grammar question or submit your corrected sentence attempt here.
                                    </div>
                                ) : (
                                    activeThread.map(message => (
                                        <div
                                            key={message.id}
                                            className={`text-sm p-2.5 rounded-lg leading-relaxed ${message.role === 'assistant'
                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                                                : 'bg-purple-600 text-white ml-8'
                                                }`}
                                        >
                                            {message.text}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-800 pt-3">
                                <div className="flex items-end gap-2">
                                    <textarea
                                        value={coachInput}
                                        onChange={(event) => setCoachInput(event.target.value)}
                                        disabled={!activeCoachError}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                sendCoachMessage();
                                            }
                                        }}
                                        placeholder={activeCoachError ? 'Type correction attempt or grammar question...' : 'Select a sentence first...'}
                                        rows={1}
                                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
                                    />
                                    <button
                                        onClick={sendCoachMessage}
                                        disabled={!activeCoachError || !coachInput.trim() || coachBusy}
                                        className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        {coachBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showAssessment && (
                <WritingAssessment
                    originalText={text}
                    topic={topic}
                    sessionId={currentSessionId}
                    contextId={contextId}
                    onSessionLinked={setCurrentSessionId}
                    onClose={() => setShowAssessment(false)}
                />
            )}
        </div>
    );
}
