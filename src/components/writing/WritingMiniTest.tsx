import React, { useEffect, useMemo, useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Languages,
    PenTool,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react';
import { WritingProfileData } from './WritingProfile';
import {
    TranslationPrompt,
    WritingHintLevel,
    WritingSentenceHint,
    generateWritingTestPrompts,
    detectWritingGrammarIssues,
    generateWritingCorrectionHints,
} from '../../services/geminiService';
import { useWritingTest, WritingTestResponse } from '../../hooks/useWritingTest';

interface WritingMiniTestProps {
    profile: WritingProfileData;
    onComplete: (responses: WritingTestResponse[], prompts: TranslationPrompt[]) => void;
    onBack?: () => void;
}

const WritingMiniTest: React.FC<WritingMiniTestProps> = ({ profile, onComplete, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [analyzingGrammar, setAnalyzingGrammar] = useState(false);
    const [loadingHints, setLoadingHints] = useState(false);
    const [prompts, setPrompts] = useState<TranslationPrompt[]>([]);
    const [hintLevel, setHintLevel] = useState<WritingHintLevel>('guided');
    const [sentenceHints, setSentenceHints] = useState<Record<number, WritingSentenceHint>>({});

    const {
        phase,
        currentPromptIndex,
        currentPrompt,
        totalPrompts,
        currentTranslation,
        setCurrentTranslation,
        translations,
        errorIndices,
        corrections,
        handleNextPrompt,
        handlePreviousPrompt,
        startCorrectionPhase,
        updateCorrection,
        resetToTranslation,
        completeTest,
    } = useWritingTest({ prompts, onComplete });

    useEffect(() => {
        const loadPrompts = async () => {
            setLoading(true);
            setSentenceHints({});
            try {
                const generatedPrompts = await generateWritingTestPrompts(profile, 5);
                setPrompts(generatedPrompts);
            } catch (error) {
                console.error('Error generating writing prompts:', error);
            }
            setLoading(false);
        };

        loadPrompts();
    }, [profile]);

    const translatedCount = useMemo(
        () => translations.filter(text => text && text.trim().length > 0).length,
        [translations]
    );

    const canContinue = currentTranslation.trim().length > 0;

    const extractQuotedSegments = (text: string): Array<{ full: string; inner: string; index: number }> => {
        const matches: Array<{ full: string; inner: string; index: number }> = [];
        const regex = /“[^”]+”|‘[^’]+’|"[^"]+"|'[^']+'/g;
        let match: RegExpExecArray | null = regex.exec(text);

        while (match) {
            const full = match[0];
            matches.push({
                full,
                inner: full.slice(1, -1).trim(),
                index: match.index,
            });
            match = regex.exec(text);
        }

        return matches;
    };

    const buildInlineBilingualHint = (firstLanguageHint: string, targetLanguageHint: string): string => {
        const firstSegments = extractQuotedSegments(firstLanguageHint);
        const targetSegments = extractQuotedSegments(targetLanguageHint);

        if (firstSegments.length === 0 || targetSegments.length === 0) {
            return `${firstLanguageHint} (${targetLanguageHint})`;
        }

        let output = '';
        let cursor = 0;

        firstSegments.forEach((segment, index) => {
            output += firstLanguageHint.slice(cursor, segment.index);

            const targetSegment = targetSegments[index];
            if (targetSegment && targetSegment.inner) {
                output += `${segment.full} ('${targetSegment.inner}')`;
            } else {
                output += segment.full;
            }

            cursor = segment.index + segment.full.length;
        });

        output += firstLanguageHint.slice(cursor);
        return output;
    };

    const getHintText = (sentenceIndex: number): { firstLanguageHint: string; targetLanguageHint: string; inlineHint: string } => {
        const hint = sentenceHints[sentenceIndex];
        let firstLanguageHint = '';
        let targetLanguageHint = '';

        if (!hint) {
            if (hintLevel === 'minimal') {
                firstLanguageHint = 'Check this sentence for grammar issues.';
                targetLanguageHint = 'Check this sentence for grammar issues.';
            } else if (hintLevel === 'guided') {
                firstLanguageHint = 'Review verb tense, word order, and article use.';
                targetLanguageHint = 'Review verb tense, word order, and article use.';
            } else {
                firstLanguageHint = 'Focus on tense consistency and phrase order where the sentence sounds unnatural.';
                targetLanguageHint = 'Focus on tense consistency and phrase order where the sentence sounds unnatural.';
            }
        } else if (hintLevel === 'minimal') {
            firstLanguageHint = hint.minimalHintFirstLanguage;
            targetLanguageHint = hint.minimalHintTargetLanguage;
        } else if (hintLevel === 'guided') {
            firstLanguageHint = hint.guidedHintFirstLanguage;
            targetLanguageHint = hint.guidedHintTargetLanguage;
        } else {
            firstLanguageHint = hint.detailedHintFirstLanguage;
            targetLanguageHint = hint.detailedHintTargetLanguage;
        }

        return {
            firstLanguageHint,
            targetLanguageHint,
            inlineHint: buildInlineBilingualHint(firstLanguageHint, targetLanguageHint),
        };
    };

    const renderHighlightedText = (text: string, suspectFragment?: string): React.ReactNode => {
        if (!text || text.trim().length === 0) {
            return '(empty)';
        }

        const fragment = (suspectFragment || '').trim();
        if (!fragment) {
            return text;
        }

        const lowerText = text.toLowerCase();
        const lowerFragment = fragment.toLowerCase();
        const start = lowerText.indexOf(lowerFragment);

        if (start < 0) {
            return text;
        }

        const end = start + fragment.length;
        return (
            <>
                {text.slice(0, start)}
                <span className="px-1 rounded bg-amber-200 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100">
                    {text.slice(start, end)}
                </span>
                {text.slice(end)}
            </>
        );
    };

    const handleAnalyzeGrammar = async () => {
        const snapshot = [...translations];
        while (snapshot.length < totalPrompts) {
            snapshot.push('');
        }
        snapshot[currentPromptIndex] = currentTranslation;

        setAnalyzingGrammar(true);
        setSentenceHints({});
        setLoadingHints(false);
        try {
            const detection = await detectWritingGrammarIssues(profile, prompts, snapshot);
            startCorrectionPhase(detection.errorIndices, snapshot);

            if (detection.errorIndices.length > 0) {
                setLoadingHints(true);
                try {
                    const hints = await generateWritingCorrectionHints(profile, prompts, snapshot, detection.errorIndices);
                    setSentenceHints(hints);
                } catch (hintError) {
                    console.error('Error generating writing hints:', hintError);
                    setSentenceHints({});
                }
                setLoadingHints(false);
            } else {
                setLoadingHints(false);
            }
        } catch (error) {
            console.error('Error analyzing grammar issues:', error);
            startCorrectionPhase([], snapshot);
            setLoadingHints(false);
        }
        setAnalyzingGrammar(false);
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Generating personalized translation prompts...</p>
                </div>
            </div>
        );
    }

    if (!currentPrompt && phase === 'translation') {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <p className="text-gray-600 dark:text-gray-400">No prompts available</p>
            </div>
        );
    }

    if (phase === 'correction') {
        return (
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PenTool className="w-5 h-5 text-purple-600" />
                        Grammar Self-Check
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        AI only flagged sentence numbers. Review and fix grammar by yourself.
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Hint level</label>
                        <select
                            value={hintLevel}
                            onChange={e => setHintLevel(e.target.value as WritingHintLevel)}
                            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                        >
                            <option value="minimal">Minimal hint</option>
                            <option value="guided">Guided hint</option>
                            <option value="detailed">Detailed hint</option>
                        </select>

                        {loadingHints && (
                            <span className="text-xs text-purple-600 dark:text-purple-300">Generating hints...</span>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-4">
                        {errorIndices.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 p-6 text-center">
                                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    No grammar errors were detected
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Great work. You can complete this mini-test now.
                                </p>
                            </div>
                        ) : (
                            errorIndices.map((sentenceIndex, position) => {
                                const promptItem = prompts[sentenceIndex];
                                if (!promptItem) {
                                    return null;
                                }

                                const originalTranslation = translations[sentenceIndex] || corrections[sentenceIndex] || '';
                                const correctedTranslation = corrections[sentenceIndex] ?? originalTranslation;
                                const hintText = getHintText(sentenceIndex);
                                const suspectFragment = sentenceHints[sentenceIndex]?.suspectFragment || '';

                                return (
                                    <div
                                        key={promptItem.id}
                                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                Sentence {sentenceIndex + 1}
                                            </h3>
                                            <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded">
                                                Flagged #{position + 1}
                                            </span>
                                        </div>

                                        <div className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Source sentence</p>
                                            <p className="text-gray-900 dark:text-white">{promptItem.sourceText}</p>
                                        </div>

                                        <div className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Your original translation</p>
                                            <p className="text-gray-900 dark:text-white leading-relaxed">
                                                {renderHighlightedText(originalTranslation, suspectFragment)}
                                            </p>
                                        </div>

                                        <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                                                Hint ({hintLevel}) - inline bilingual
                                            </p>
                                            <p className="text-sm text-amber-900 dark:text-amber-100">
                                                {hintText.inlineHint}
                                            </p>
                                            {suspectFragment && (
                                                <p className="text-xs text-amber-800 dark:text-amber-200 mt-2">
                                                    Where to edit: "{suspectFragment}"
                                                </p>
                                            )}
                                            {sentenceHints[sentenceIndex]?.focusArea && hintLevel === 'detailed' && (
                                                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                                                    Focus area: {sentenceHints[sentenceIndex].focusArea}
                                                </p>
                                            )}
                                        </div>

                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Your corrected version
                                        </label>
                                        <textarea
                                            value={correctedTranslation}
                                            onChange={e => updateCorrection(sentenceIndex, e.target.value)}
                                            className="w-full h-24 p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
                                            placeholder="Rewrite this sentence with better grammar"
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                        <button
                            onClick={resetToTranslation}
                            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            Back to Translation
                        </button>

                        <button
                            onClick={completeTest}
                            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                        >
                            Complete Test
                            <CheckCircle2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Languages className="w-5 h-5 text-purple-600" />
                        Translation Mini-Test
                    </h2>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Sentence {currentPromptIndex + 1} of {totalPrompts}
                    </div>
                </div>

                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                    <div
                        className="h-full bg-purple-600 transition-all duration-300"
                        style={{ width: `${((currentPromptIndex + 1) / Math.max(totalPrompts, 1)) * 100}%` }}
                    />
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Completed translations: {translatedCount}/{totalPrompts}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium mb-5">
                        {currentPrompt?.scenario || 'Translation'}
                        <span className="text-xs opacity-70">Difficulty {currentPrompt?.difficulty || 1}/5</span>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Translate this sentence:</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white leading-relaxed">
                            {currentPrompt?.sourceText || ''}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Your translation ({profile.targetLanguage})
                        </label>
                        <textarea
                            value={currentTranslation}
                            onChange={e => setCurrentTranslation(e.target.value)}
                            className="w-full h-32 p-4 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
                            placeholder="Type your translation here..."
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <button
                        onClick={currentPromptIndex === 0 ? onBack : handlePreviousPrompt}
                        disabled={currentPromptIndex === 0 && !onBack}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        {currentPromptIndex === 0 ? 'Back' : 'Previous'}
                    </button>

                    <button
                        onClick={currentPromptIndex < totalPrompts - 1 ? handleNextPrompt : handleAnalyzeGrammar}
                        disabled={!canContinue || analyzingGrammar}
                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {analyzingGrammar
                            ? 'Checking Grammar...'
                            : currentPromptIndex < totalPrompts - 1
                                ? 'Next Sentence'
                                : 'Check Grammar'}
                        {!analyzingGrammar && <ChevronRight className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WritingMiniTest;
