import React, { useState } from 'react';
import { improveWriting, WritingFeedback } from '../../services/geminiService';
import { Loader2, CheckCircle, XCircle, Wand2, ArrowRight, Save, Check } from 'lucide-react';
import { api } from '../../db';

interface WritingAssessmentProps {
    originalText: string;
    topic: string;
    sessionId?: string;
    contextId?: string;
    onSessionLinked?: (sessionId: string) => void;
    onClose: () => void;
}

export default function WritingAssessment({ originalText, topic, sessionId, contextId, onSessionLinked, onClose }: WritingAssessmentProps) {
    const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSavingReview, setIsSavingReview] = useState(false);
    const [isReviewSaved, setIsReviewSaved] = useState(false);

    // Fetch feedback on mount
    React.useEffect(() => {
        const getFeedback = async () => {
            try {
                const res = await improveWriting(originalText, topic);
                setFeedback(res);
            } catch (error) {
                console.error("Failed to get writing feedback", error);
            } finally {
                setLoading(false);
            }
        };
        getFeedback();
    }, [originalText, topic]);

    const handleSaveReview = async () => {
        if (!feedback || isSavingReview || isReviewSaved) {
            return;
        }

        try {
            setIsSavingReview(true);
            let linkedSessionId = sessionId;

            if (!linkedSessionId) {
                const savedSession = await api.saveWritingSession({
                    topic,
                    content: originalText,
                    contextId,
                    createdAt: Date.now(),
                });
                linkedSessionId = savedSession.id;
                onSessionLinked?.(linkedSessionId);
            }

            await api.saveWritingReview({
                sessionId: linkedSessionId,
                topic,
                originalText,
                correctedText: feedback.correctedText,
                score: feedback.score,
                strengths: feedback.strengths,
                weaknesses: feedback.weaknesses,
                suggestions: feedback.suggestions,
                createdAt: Date.now(),
            });
            setIsReviewSaved(true);
        } catch (error) {
            console.error('Failed to save AI review', error);
            alert('Failed to save AI review. Please try again.');
        } finally {
            setIsSavingReview(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Wand2 className="text-indigo-500" />
                        AI Editor's Report
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">✕</button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
                            <h4 className="text-xl font-medium text-gray-900 dark:text-gray-100">Analyzing your writing...</h4>
                            <p className="text-gray-500 mt-2">Checking grammar, vocabulary, and style.</p>
                        </div>
                    ) : feedback ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Analysis Column */}
                            <div className="space-y-6">
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl text-center">
                                    <span className="block text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Overall Score</span>
                                    <span className="text-5xl font-black text-indigo-700 dark:text-indigo-300">{feedback.score}</span>
                                    <span className="text-xl text-indigo-400">/100</span>
                                </div>

                                <div>
                                    <h4 className="text-lg font-bold flex items-center gap-2 text-green-600 dark:text-green-400 mb-3">
                                        <CheckCircle className="w-5 h-5" /> Strengths
                                    </h4>
                                    <ul className="space-y-2">
                                        {feedback.strengths.map((s, i) => (
                                            <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-300 bg-green-50 dark:bg-green-900/10 p-2 rounded">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="text-lg font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-3">
                                        <XCircle className="w-5 h-5" /> Areas for Improvement
                                    </h4>
                                    <ul className="space-y-2">
                                        {feedback.weaknesses.map((w, i) => (
                                            <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/10 p-2 rounded">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                                                {w}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Revision Column */}
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-lg font-bold mb-3">Suggested Revision</h4>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 leading-relaxed font-serif text-lg">
                                        {feedback.correctedText.split('\n').map((p, i) => (
                                            <p key={i} className="mb-4 text-gray-800 dark:text-gray-200">{p}</p>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-bold mb-3">Top Suggestions</h4>
                                    <div className="space-y-3">
                                        {feedback.suggestions.map((s, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-blue-800 dark:text-blue-200">
                                                <ArrowRight className="w-5 h-5 mt-0.5 shrink-0" />
                                                {s}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-red-500">
                            Failed to generate feedback. Please try again.
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky bottom-0 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">
                        {sessionId
                            ? (isReviewSaved ? 'AI review saved to this writing session.' : 'You can save this AI review for future study.')
                            : (isReviewSaved ? 'AI review saved. A linked writing session was created automatically.' : 'Save AI review to store it in your writing history.')}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSaveReview}
                            disabled={loading || !feedback || isSavingReview || isReviewSaved}
                            className="px-4 py-2 rounded-lg font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isReviewSaved ? <Check className="w-4 h-4 text-green-600" /> : <Save className="w-4 h-4" />}
                            {isSavingReview ? 'Saving...' : isReviewSaved ? 'Saved' : 'Save AI Review'}
                        </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium"
                    >
                        Close Report
                    </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
