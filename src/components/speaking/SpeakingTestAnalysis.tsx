import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, AlertCircle, ArrowRight, Brain, BarChart, Mic } from 'lucide-react';
import { SpeakingProfileData } from './SpeakingProfile';
import { SpeakingTestResponse } from '../../hooks/useSpeakingTest';
import {
    TranslationPrompt,
    SpeakingAnalysis,
    analyzeSpeakingTestResults,
} from '../../services/geminiService';

interface SpeakingTestAnalysisProps {
    profile: SpeakingProfileData;
    prompts: TranslationPrompt[];
    testResponse: SpeakingTestResponse;
    cachedAnalysis?: SpeakingAnalysis;
    variant?: 'page' | 'embedded';
}

const SpeakingTestAnalysis: React.FC<SpeakingTestAnalysisProps> = ({
    profile,
    prompts,
    testResponse,
    cachedAnalysis,
    variant = 'page',
}) => {
    const isEmbedded = variant === 'embedded';
    const [analysis, setAnalysis] = useState<SpeakingAnalysis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (cachedAnalysis) {
            setAnalysis(cachedAnalysis);
            setLoading(false);
            return;
        }

        const analyzeResults = async () => {
            setLoading(true);

            try {
                const result = await analyzeSpeakingTestResults(
                    profile,
                    prompts,
                    testResponse.translationResponses,
                    testResponse.conversationTranscript
                );
                setAnalysis(result);

                // Cache to localStorage
                try {
                    const stateToSave = {
                        profile,
                        testCompleted: true,
                        testResponse,
                        prompts,
                        analysis: result,
                    };
                    localStorage.setItem('speakingAssessmentState', JSON.stringify(stateToSave));
                } catch (storageError) {
                    console.error('Error caching assessment:', storageError);
                }

                // Save to backend
                try {
                    await fetch('/api/speaking/assessment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            profileId: profile.id || 'default',
                            prompts,
                            responses: testResponse.translationResponses,
                            conversationTranscript: testResponse.conversationTranscript,
                            analysis: result,
                        }),
                    });
                } catch (saveError) {
                    console.error('Error saving assessment:', saveError);
                }
            } catch (error) {
                console.error('Error analyzing results:', error);
            }

            setLoading(false);
        };

        analyzeResults();
    }, [cachedAnalysis, profile, prompts, testResponse]);

    if (loading) {
        return (
            <div className={isEmbedded ? "py-8" : "flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900"}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Analyzing your speaking results...</p>
                </div>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className={isEmbedded ? "py-8 text-center" : "flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900"}>
                <p className="text-gray-600 dark:text-gray-400">Unable to analyze results</p>
            </div>
        );
    }

    const renderStars = (level: number) => (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => (
                <Star
                    key={i}
                    className={`w-5 h-5 ${i <= level ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
                />
            ))}
        </div>
    );

    const getBarrierInfo = (barrier: string) => {
        switch (barrier) {
            case 'pronunciation':
                return { emoji: '🗣️', text: 'Pronunciation', desc: 'Pronunciation is the main area to focus on' };
            case 'grammar':
                return { emoji: '📝', text: 'Grammar', desc: 'Grammar structures need the most attention' };
            case 'vocabulary':
                return { emoji: '📚', text: 'Vocabulary', desc: 'Expanding vocabulary is the priority' };
            case 'fluency':
                return { emoji: '⏸️', text: 'Fluency', desc: 'Building fluency and reducing hesitation is key' };
            default:
                return { emoji: '⚖️', text: 'Balanced', desc: 'Multiple areas need balanced attention' };
        }
    };

    const barrierInfo = getBarrierInfo(analysis.primaryBarrier);

    const analysisContent = (
        <div className={isEmbedded ? "space-y-6" : "max-w-4xl mx-auto space-y-6"}>
            {/* Overall Level */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Overall Speaking Level
                        </h3>
                        {renderStars(analysis.overallLevel)}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Level {analysis.overallLevel} of 5
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pronunciation</div>
                        <div className="text-2xl font-bold text-green-600">Level {analysis.pronunciationLevel}</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Grammar</div>
                        <div className="text-2xl font-bold text-blue-600">Level {analysis.grammarLevel}</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Vocabulary</div>
                        <div className="text-2xl font-bold text-purple-600">Level {analysis.vocabularyLevel}</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fluency</div>
                        <div className="text-2xl font-bold text-orange-600">Level {analysis.fluencyLevel}</div>
                    </div>
                </div>
            </div>

            {/* Primary Barrier */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Primary Barrier: {barrierInfo.text} {barrierInfo.emoji}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{barrierInfo.desc}</p>
            </div>

            {/* Performance Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart className="w-5 h-5 text-green-600" />
                    Performance Summary
                </h3>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex justify-between">
                        <span>Translation accuracy:</span>
                        <span className={`font-medium ${
                            analysis.translationAccuracy >= 80 ? 'text-green-600' :
                            analysis.translationAccuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                            {analysis.translationAccuracy.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Conversation coherence:</span>
                        <span className={`font-medium ${
                            analysis.conversationCoherence >= 80 ? 'text-green-600' :
                            analysis.conversationCoherence >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                            {analysis.conversationCoherence.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Prompts answered:</span>
                        <span className="font-medium">{analysis.statistics.totalPromptsAnswered}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Conversation turns:</span>
                        <span className="font-medium">{analysis.statistics.totalConversationTurns}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Avg response time:</span>
                        <span className="font-medium">{(analysis.statistics.avgResponseTime / 1000).toFixed(1)}s</span>
                    </div>
                </div>
            </div>

            {/* Strengths */}
            {analysis.strengths.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-6">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Strengths
                    </h3>
                    <ul className="space-y-2">
                        {analysis.strengths.map((strength, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-green-800 dark:text-green-200">
                                <span className="text-green-600 mt-0.5">✓</span>
                                <span>{strength}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Areas for Improvement */}
            {analysis.weaknesses.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-6">
                    <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                        {analysis.weaknesses.map((weakness, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-orange-800 dark:text-orange-200">
                                <span className="text-orange-600 mt-0.5">⚠</span>
                                <span>{weakness}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Grammar Errors */}
            {analysis.grammarErrors.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Grammar Errors
                    </h3>
                    <div className="space-y-4">
                        {analysis.grammarErrors.map((error, idx) => (
                            <div key={idx} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-orange-900 dark:text-orange-100">{error.pattern}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded ${
                                            error.severity === 'minor' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                                            error.severity === 'moderate' ? 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                                            'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                                        }`}>
                                            {error.severity}
                                        </span>
                                        <span className="text-sm text-orange-700 dark:text-orange-300">
                                            {error.count} instances
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {error.examples.map((example, i) => (
                                        <p key={i} className="text-xs text-orange-800 dark:text-orange-200 italic pl-4 border-l-2 border-orange-300 dark:border-orange-700">
                                            "{example}"
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Vocabulary Gaps */}
            {analysis.vocabularyGaps.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Vocabulary Gaps
                    </h3>
                    <div className="space-y-4">
                        {analysis.vocabularyGaps.map((gap, idx) => (
                            <div key={idx} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-yellow-900 dark:text-yellow-100">{gap.category}</h4>
                                    <span className="text-sm text-yellow-700 dark:text-yellow-300">{gap.count} words</span>
                                </div>
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    {gap.examples.join(', ')}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-6">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Recommendations
                </h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Recommended Level</h4>
                        <p className="text-green-900 dark:text-green-100">
                            Practice at Level {analysis.recommendations.recommendedLevel} difficulty
                        </p>
                    </div>
                    {analysis.recommendations.focusAreas.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Focus Areas</h4>
                            <ul className="space-y-1">
                                {analysis.recommendations.focusAreas.map((area, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-green-800 dark:text-green-200">
                                        <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {analysis.recommendations.practiceTypes.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Suggested Practice</h4>
                            <p className="text-green-800 dark:text-green-200">
                                {analysis.recommendations.practiceTypes.join(', ')}
                            </p>
                        </div>
                    )}
                    {analysis.recommendations.nextSteps.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Next Steps</h4>
                            <ul className="space-y-1">
                                {analysis.recommendations.nextSteps.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-green-800 dark:text-green-200">
                                        <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (isEmbedded) {
        return analysisContent;
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Mic className="w-6 h-6 text-green-600" />
                    Speaking Assessment Results
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {analysisContent}
            </div>
        </div>
    );
};

export default SpeakingTestAnalysis;
