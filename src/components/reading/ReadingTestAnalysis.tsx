import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, BookOpen, Brain, Zap, CheckCircle, AlertCircle, ArrowRight, BarChart } from 'lucide-react';
import { ReadingProfileData } from './ReadingProfile';
import { ReadingTestResponse } from '../../hooks/useReadingTest';
import { GeneratedPassage, ReadingAnalysis, analyzeReadingTestResults } from '../../services/geminiService';

interface ReadingTestAnalysisProps {
    profile: ReadingProfileData;
    passages: GeneratedPassage[];
    responses: ReadingTestResponse[];
    cachedAnalysis?: ReadingAnalysis;  // Optional pre-computed analysis to skip AI call
    onStartLearning?: () => void;
    onRetakeAssessment?: () => void;
    onViewHistory?: () => void;
    variant?: 'page' | 'embedded';  // 'page' shows full header/container, 'embedded' is for use inside results page
}

const ReadingTestAnalysis: React.FC<ReadingTestAnalysisProps> = ({
    profile,
    passages,
    responses,
    cachedAnalysis,
    onStartLearning,
    onRetakeAssessment,
    onViewHistory,
    variant = 'page',
}) => {
    const isEmbedded = variant === 'embedded';
    const [analysis, setAnalysis] = useState<ReadingAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAllWords, setShowAllWords] = useState(false);
    const [showAllSentences, setShowAllSentences] = useState(false);

    useEffect(() => {
        if (cachedAnalysis) {
            setAnalysis(cachedAnalysis);
            setLoading(false);
            return;
        }

        const analyzeResults = async () => {
            setLoading(true);

            // Convert responses to maps for analysis
            const markedWords = new Map();
            const markedSentences = new Map();
            const readingTimes = new Map();

            responses.forEach(response => {
                markedWords.set(response.passageId, response.markedWords);
                markedSentences.set(response.passageId, response.markedSentences);
                readingTimes.set(response.passageId, response.readingTimeMs);
            });

            try {
                const result = await analyzeReadingTestResults(
                    profile,
                    passages,
                    markedWords,
                    markedSentences,
                    readingTimes
                );
                setAnalysis(result);

                try {
                    const stateToSave = {
                        profile,
                        testCompleted: true,
                        testResponses: responses,
                        testPassages: passages,
                        analysis: result,
                    };
                    localStorage.setItem('readingAssessmentState', JSON.stringify(stateToSave));
                } catch (storageError) {
                    console.error('Error caching assessment:', storageError);
                }

                // Save assessment results to backend
                try {
                    await fetch('/api/reading/assessment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            profileId: profile.id || 'default',
                            passages: passages,
                            responses: responses,
                            analysis: result,
                        }),
                    });
                } catch (saveError) {
                    console.error('Error saving assessment:', saveError);
                    // Continue even if save fails
                }
            } catch (error) {
                console.error('Error analyzing results:', error);
            }

            setLoading(false);
        };

        analyzeResults();
    }, [cachedAnalysis, profile, passages, responses]);

    if (loading) {
        return (
            <div className={isEmbedded ? "py-8" : "flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900"}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Analyzing your results...</p>
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

    // Render stars for level display
    const renderStars = (level: number) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                    <Star
                        key={i}
                        className={`w-5 h-5 ${i <= level ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
                    />
                ))}
            </div>
        );
    };

    // Get primary barrier emoji and description
    const getBarrierInfo = (barrier: string) => {
        switch (barrier) {
            case 'vocabulary':
                return { emoji: '📚', text: 'Vocabulary', desc: 'Unknown words are the main challenge' };
            case 'grammar':
                return { emoji: '📝', text: 'Grammar', desc: 'Grammar structures are the main challenge' };
            default:
                return { emoji: '⚖️', text: 'Balanced', desc: 'Both vocabulary and grammar need attention' };
        }
    };

    const barrierInfo = getBarrierInfo(analysis.primaryBarrier);

    // Content to be rendered (shared between page and embedded modes)
    const analysisContent = (
        <div className={isEmbedded ? "space-y-6" : "max-w-4xl mx-auto space-y-6"}>
            {/* Overall Level */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Overall Reading Level
                        </h3>
                        {renderStars(analysis.overallLevel)}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Level {analysis.overallLevel} of 5
                        </p>
                    </div>
                </div>

                {/* Sub-levels */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Vocabulary</div>
                        <div className="text-2xl font-bold text-blue-600">Level {analysis.vocabularyLevel}</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Grammar</div>
                        <div className="text-2xl font-bold text-green-600">Level {analysis.grammarLevel}</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Reading Speed</div>
                        <div className="text-2xl font-bold text-purple-600 capitalize">{analysis.readingSpeed}</div>
                    </div>
                </div>
            </div>

            {/* Primary Barrier */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Primary Barrier: {barrierInfo.text} {barrierInfo.emoji}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                    {barrierInfo.desc}
                </p>
            </div>

            {/* Performance Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart className="w-5 h-5 text-blue-600" />
                    Performance Summary
                </h3>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex justify-between">
                        <span>Words marked:</span>
                        <span className="font-medium">{analysis.statistics.totalWordsMarked} out of {analysis.statistics.totalWordsRead} ({(100 - analysis.statistics.vocabularyCoverage).toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Sentences marked:</span>
                        <span className="font-medium">{analysis.statistics.totalSentencesMarked} out of {analysis.statistics.totalSentencesRead} ({(100 - analysis.statistics.sentenceComprehension).toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Vocabulary coverage:</span>
                        <span className={`font-medium ${analysis.statistics.vocabularyCoverage >= 90 ? 'text-green-600' : analysis.statistics.vocabularyCoverage >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {analysis.statistics.vocabularyCoverage.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Sentence comprehension:</span>
                        <span className={`font-medium ${analysis.statistics.sentenceComprehension >= 90 ? 'text-green-600' : analysis.statistics.sentenceComprehension >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {analysis.statistics.sentenceComprehension.toFixed(1)}%
                        </span>
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

            {/* Vocabulary Gaps */}
            {analysis.vocabularyGaps.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        📚 Vocabulary Gaps (Top Categories)
                    </h3>
                    <div className="space-y-4">
                        {analysis.vocabularyGaps.map((gap, idx) => (
                            <div key={idx} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                                        {gap.category}
                                    </h4>
                                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                                        {gap.count} words
                                    </span>
                                </div>
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    {gap.examples.join(', ')}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Grammar Challenges */}
            {analysis.grammarChallenges.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        📝 Grammar Challenges (Top Patterns)
                    </h3>
                    <div className="space-y-4">
                        {analysis.grammarChallenges.map((challenge, idx) => (
                            <div key={idx} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-orange-900 dark:text-orange-100">
                                        {challenge.pattern}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs px-2 py-1 bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded">
                                            {challenge.difficulty}
                                        </span>
                                        <span className="text-sm text-orange-700 dark:text-orange-300">
                                            {challenge.count} instances
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {challenge.examples.map((example, i) => (
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

            {/* Combined Issues */}
            {analysis.combinedIssues && analysis.combinedIssues.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        🔄 Combined Issues (Vocabulary + Grammar)
                    </h3>
                    <div className="space-y-3">
                        {analysis.combinedIssues.slice(0, 3).map((issue, idx) => (
                            <div key={idx} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                                <p className="text-sm text-red-900 dark:text-red-100 italic mb-2">
                                    "{issue.sentence.substring(0, 100)}..."
                                </p>
                                <div className="flex gap-4 text-xs text-red-700 dark:text-red-300">
                                    <span>Marked words: {issue.markedWords.join(', ')}</span>
                                    <span>Pattern: {issue.grammarPattern}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Recommendations
                </h3>

                <div className="space-y-4">
                    <div>
                        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                            Recommended Level
                        </h4>
                        <p className="text-blue-900 dark:text-blue-100">
                            Start with Level {analysis.recommendations.recommendedLevel} reading materials
                        </p>
                    </div>

                    {analysis.recommendations.focusAreas.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                Focus Areas
                            </h4>
                            <ul className="space-y-1">
                                {analysis.recommendations.focusAreas.map((area, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-blue-800 dark:text-blue-200">
                                        <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {analysis.recommendations.suggestedContent.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                Suggested Content Types
                            </h4>
                            <p className="text-blue-800 dark:text-blue-200">
                                {analysis.recommendations.suggestedContent.join(', ')}
                            </p>
                        </div>
                    )}

                    {analysis.recommendations.nextSteps.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                Next Steps
                            </h4>
                            <ul className="space-y-1">
                                {analysis.recommendations.nextSteps.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-blue-800 dark:text-blue-200">
                                        <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.markedWordsList.length > 0 && (
                    <button
                        onClick={() => setShowAllWords(!showAllWords)}
                        className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        {showAllWords ? 'Hide' : 'View All'} Marked Words ({analysis.markedWordsList.length})
                    </button>
                )}

                {analysis.markedSentencesList.length > 0 && (
                    <button
                        onClick={() => setShowAllSentences(!showAllSentences)}
                        className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        {showAllSentences ? 'Hide' : 'View All'} Marked Sentences ({analysis.markedSentencesList.length})
                    </button>
                )}

                {!isEmbedded && onRetakeAssessment && (
                    <button
                        onClick={onRetakeAssessment}
                        className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Retake Assessment
                    </button>
                )}

                {!isEmbedded && onStartLearning && (
                    <button
                        onClick={onStartLearning}
                        className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Zap className="w-5 h-5" />
                        Start Learning Plan
                    </button>
                )}
            </div>

            {/* All Marked Words List */}
            {showAllWords && analysis.markedWordsList.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        All Marked Words
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {analysis.markedWordsList.map((word, idx) => (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {word.word}
                                    </span>
                                    <div className="flex gap-1">
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            word.difficulty === 'basic' ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' :
                                            word.difficulty === 'intermediate' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                                            'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                                        }`}>
                                            {word.difficulty}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            word.frequency === 'high' ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200' :
                                            word.frequency === 'medium' ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200' :
                                            'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                        }`}>
                                            {word.frequency} freq
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                    "{word.context.substring(0, 60)}..."
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All Marked Sentences List */}
            {showAllSentences && analysis.markedSentencesList.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        All Marked Sentences
                    </h3>
                    <div className="space-y-3">
                        {analysis.markedSentencesList.map((sentence, idx) => (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <p className="text-sm text-gray-900 dark:text-white italic flex-1">
                                        "{sentence.sentence}"
                                    </p>
                                    <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                                        sentence.complexity === 'moderate' ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' :
                                        sentence.complexity === 'high' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                                        'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                                    }`}>
                                        {sentence.complexity}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {sentence.grammarPatterns.map((pattern, i) => (
                                        <span key={i} className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded">
                                            {pattern}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    // Embedded mode: return content directly without page wrapper
    if (isEmbedded) {
        return analysisContent;
    }

    // Page mode: return full page layout
    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                    Reading Assessment Results
                </h2>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-y-auto p-6">
                {analysisContent}
            </div>
        </div>
    );
};

export default ReadingTestAnalysis;
