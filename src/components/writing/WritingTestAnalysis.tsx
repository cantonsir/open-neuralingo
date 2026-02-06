import React, { useEffect, useState } from 'react';
import {
    Star,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    BarChart,
    PenTool,
} from 'lucide-react';
import { WritingProfileData } from './WritingProfile';
import { WritingTestResponse } from '../../hooks/useWritingTest';
import {
    TranslationPrompt,
    WritingAnalysis,
    analyzeWritingTestResults,
} from '../../services/geminiService';

interface WritingTestAnalysisProps {
    profile: WritingProfileData;
    prompts: TranslationPrompt[];
    responses: WritingTestResponse[];
    cachedAnalysis?: WritingAnalysis;
    variant?: 'page' | 'embedded';
}

const WritingTestAnalysis: React.FC<WritingTestAnalysisProps> = ({
    profile,
    prompts,
    responses,
    cachedAnalysis,
    variant = 'page',
}) => {
    const isEmbedded = variant === 'embedded';
    const [analysis, setAnalysis] = useState<WritingAnalysis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (cachedAnalysis) {
            setAnalysis(cachedAnalysis);
            setLoading(false);
            return;
        }

        const runAnalysis = async () => {
            setLoading(true);

            try {
                const result = await analyzeWritingTestResults(profile, prompts, responses);
                setAnalysis(result);

                try {
                    const stateToSave = {
                        profile,
                        testPrompts: prompts,
                        testResponses: responses,
                        analysis: result,
                    };
                    localStorage.setItem('writingAssessmentState', JSON.stringify(stateToSave));
                } catch (storageError) {
                    console.error('Error caching writing assessment:', storageError);
                }

                try {
                    await fetch('/api/writing/assessment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            profileId: profile.id || 'default',
                            prompts,
                            responses,
                            analysis: result,
                        }),
                    });
                } catch (saveError) {
                    console.error('Error saving writing assessment:', saveError);
                }
            } catch (error) {
                console.error('Error analyzing writing test:', error);
            }

            setLoading(false);
        };

        runAnalysis();
    }, [cachedAnalysis, profile, prompts, responses]);

    if (loading) {
        return (
            <div className={isEmbedded ? 'py-8' : 'flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900'}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Analyzing your writing results...</p>
                </div>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className={isEmbedded ? 'py-8 text-center' : 'flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900'}>
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

    const analysisContent = (
        <div className={isEmbedded ? 'space-y-6' : 'max-w-4xl mx-auto space-y-6'}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Overall Writing Level</h3>
                {renderStars(analysis.overallLevel)}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Level {analysis.overallLevel} of 5</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Grammar</div>
                        <div className="text-xl font-bold text-purple-600">L{analysis.grammarLevel}</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Vocabulary</div>
                        <div className="text-xl font-bold text-blue-600">L{analysis.vocabularyLevel}</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Accuracy</div>
                        <div className="text-xl font-bold text-green-600">{analysis.translationAccuracy.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Self-Correction</div>
                        <div className="text-xl font-bold text-amber-600">{analysis.selfCorrectionRate.toFixed(1)}%</div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart className="w-5 h-5 text-purple-600" />
                    Performance Summary
                </h3>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex justify-between">
                        <span>Total sentences:</span>
                        <span className="font-medium">{analysis.statistics.totalSentences}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Sentences with grammar issues:</span>
                        <span className="font-medium">{analysis.statistics.sentencesWithErrors}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Sentences corrected by user:</span>
                        <span className="font-medium">{analysis.statistics.sentencesCorrected}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Average translation time:</span>
                        <span className="font-medium">{(analysis.statistics.avgTranslationTime / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Average correction time:</span>
                        <span className="font-medium">{(analysis.statistics.avgCorrectionTime / 1000).toFixed(1)}s</span>
                    </div>
                </div>
            </div>

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

            {analysis.weaknesses.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-6">
                    <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                        {analysis.weaknesses.map((weakness, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-orange-800 dark:text-orange-200">
                                <span className="text-orange-600 mt-0.5">!</span>
                                <span>{weakness}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sentence-by-Sentence Review</h3>
                <div className="space-y-3">
                    {analysis.sentenceReports.map((report, idx) => (
                        <div
                            key={`${report.promptId}-${idx}`}
                            className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Sentence {idx + 1}</span>
                                {report.hasGrammarError ? (
                                    <span className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                                        Grammar flagged
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                        Clean
                                    </span>
                                )}
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Source: {report.sourceText}</p>
                            <p className="text-sm text-gray-900 dark:text-white mb-1">
                                Initial: {report.initialTranslation || '(empty)'}
                            </p>
                            {report.hasGrammarError && (
                                <p className="text-sm text-purple-700 dark:text-purple-300">
                                    Corrected: {report.correctedTranslation || '(empty)'}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-6">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-4">Recommendations</h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Recommended Level</h4>
                        <p className="text-purple-900 dark:text-purple-100">
                            Continue practice around Level {analysis.recommendations.recommendedLevel}
                        </p>
                    </div>

                    {analysis.recommendations.focusAreas.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Focus Areas</h4>
                            <ul className="space-y-1">
                                {analysis.recommendations.focusAreas.map((area, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-purple-800 dark:text-purple-200">
                                        <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {analysis.recommendations.nextSteps.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Next Steps</h4>
                            <ul className="space-y-1">
                                {analysis.recommendations.nextSteps.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-purple-800 dark:text-purple-200">
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
                    <PenTool className="w-6 h-6 text-purple-600" />
                    Writing Assessment Results
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{analysisContent}</div>
        </div>
    );
};

export default WritingTestAnalysis;
