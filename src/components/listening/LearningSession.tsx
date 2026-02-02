import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft,
    Play,
    RotateCcw,
    Volume2,
    ChevronRight,
    Check,
    HelpCircle,
    Loader2,
    Trophy,
    Target,
    BookOpen,
    Eye,
    RefreshCw,
    Zap,
    X
} from 'lucide-react';
import ListeningFeedbackSliders from './ListeningFeedbackSliders';
import VocabularyBreakdown from './VocabularyBreakdown';
import { useListeningTest, TestResponseData } from '../../hooks/useListeningTest';
import { api, SegmentMastery, SegmentTestResult, SegmentLesson } from '../../db';
import {
    generateSegmentTestSentences,
    SegmentTestSentence,
    analyzeListeningResults,
    TestResult,
    ListeningAnalysis,
    generateSegmentLessons,
    SegmentLessonContent
} from '../../services/geminiService';

interface LearningSessionProps {
    goalId: string;
    videoId: string;
    segmentIndex: number;
    segmentSubtitle: string[];
    segmentStartTime: number;
    segmentEndTime: number;
    onExit: () => void;
    onComplete: () => void;
    onLoadSession?: (session: any) => void;
    onNavigateToAudioGenerator?: (testData: {
        markedWords: string[];
        testSentences: string[];
        aiFeedback: string;
        context: string;
    }) => void;
}

type Phase = 'loading' | 'test' | 'analyzing' | 'results' | 'learning' | 'watch' | 'summary';

export default function LearningSession({
    goalId,
    videoId,
    segmentIndex,
    segmentSubtitle,
    segmentStartTime,
    segmentEndTime,
    onExit,
    onComplete,
    onLoadSession,
    onNavigateToAudioGenerator
}: LearningSessionProps) {
    // Phase state
    const [phase, setPhase] = useState<Phase>('loading');
    const [loadingMessage, setLoadingMessage] = useState('Preparing your test...');

    // Test state
    const [sentences, setSentences] = useState<SegmentTestSentence[]>([]);
    const [testResponses, setTestResponses] = useState<TestResponseData[]>([]);

    // Results state
    const [analysis, setAnalysis] = useState<ListeningAnalysis | null>(null);
    const [testAccuracy, setTestAccuracy] = useState(0);
    const [mastery, setMastery] = useState<SegmentMastery | null>(null);

    // Learning state
    const [lessons, setLessons] = useState<SegmentLessonContent[]>([]);
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0);

    // Summary state (for viewing completed lessons)
    const [savedTests, setSavedTests] = useState<SegmentTestResult[]>([]);
    const [savedLessons, setSavedLessons] = useState<SegmentLesson[]>([]);

    // Handle test completion - analyze results and transition to results phase
    const handleTestComplete = useCallback(async (responses: TestResponseData[]) => {
        setTestResponses(responses);
        setPhase('analyzing');

        const testResults: TestResult[] = responses.map(r => ({
            sentence: r.sentence,
            understood: r.understood,
            replays: r.replays,
            reactionTimeMs: r.reactionTimeMs,
            markedWordIndices: r.markedIndices,
            wordBoundaries: r.wordBoundaries,
            familiarity: r.familiarity,
            meaningClarity: r.meaningClarity,
        }));

        const analysisResult = await analyzeListeningResults(testResults);
        setAnalysis(analysisResult);

        const score = responses.filter(r => r.understood).length;
        const accuracy = score / responses.length;
        setTestAccuracy(accuracy);

        // Save test to database
        try {
            await api.saveSegmentTest(goalId, segmentIndex, {
                sentences: sentences.map(s => ({ id: s.id, sentence: s.sentence, difficulty: s.difficulty })),
                responses,
                analysis: analysisResult
            });
        } catch (error) {
            console.error("Failed to save test:", error);
        }

        setPhase('results');
    }, [goalId, segmentIndex, sentences]);

    // Use shared listening test hook
    const test = useListeningTest({
        sentences,
        onComplete: handleTestComplete,
        autoPlay: phase === 'test',
        includeSentenceId: false,
    });

    const {
        currentIndex,
        currentSentence,
        showTranscript,
        replays,
        markedIndices,
        showSliders,
        sliderValues,
        isPlaying,
        audioProgress,
        handleReplay,
        handleSlowPlay,
        toggleWordMark,
        toggleWordRange,
        revealTranscript,
        handleNotSure,
        handleResponse,
        handleSliderSubmit,
        setSliderValues,
        reset: resetTest,
        stopAll,
        preloadAudio,
        clearCache,
        isExiting,
    } = test;

    // Initialize test
    useEffect(() => {
        let cancelled = false; // Guard against StrictMode double-run

        const initTest = async () => {
            setPhase('loading');
            setLoadingMessage('Loading lesson data...');

            // Reset test state
            resetTest();

            try {
                // Get segment mastery status first
                const masteryData = await api.getSegmentMastery(goalId, segmentIndex);
                if (cancelled) return; // Exit if component unmounted
                setMastery(masteryData);

                // If lesson is completed, show summary view
                if (masteryData && masteryData.videoWatched) {
                    setLoadingMessage('Loading your results...');

                    // Fetch saved test results and lessons
                    const [tests, lessonData] = await Promise.all([
                        api.getSegmentTests(goalId, segmentIndex),
                        api.getSegmentLessons(goalId, segmentIndex)
                    ]);

                    if (cancelled) return;
                    setSavedTests(tests);
                    setSavedLessons(lessonData);

                    // Set analysis from the most recent test
                    if (tests.length > 0 && tests[0].analysis) {
                        setAnalysis(tests[0].analysis as ListeningAnalysis);
                        setTestAccuracy(tests[0].accuracy);
                    }

                    setPhase('summary');
                    return;
                }

                // Otherwise, start a new test
                setLoadingMessage('Loading your profile...');

                // Get user profile from assessment
                let userProfile = {
                    listeningLevel: 2,
                    difficulties: [] as string[],
                    weaknesses: [] as string[]
                };

                const profileRes = await fetch('/api/assessment/profile');
                if (cancelled) return;
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    if (profile) {
                        userProfile.listeningLevel = profile.listeningLevel || 2;
                        userProfile.difficulties = profile.difficulties || [];
                    }
                }

                // Get previous test analysis for weaknesses
                const resultsRes = await fetch('/api/assessment/results');
                if (cancelled) return;
                if (resultsRes.ok) {
                    const results = await resultsRes.json();
                    if (results.length > 0 && results[0].analysis) {
                        userProfile.weaknesses = results[0].analysis.weaknesses || [];
                    }
                }

                // Generate AI test sentences based on segment content
                setLoadingMessage('AI is creating your test...');
                const testSentences = await generateSegmentTestSentences(
                    segmentSubtitle,
                    userProfile,
                    5 // 5 questions per segment test
                );
                if (cancelled) return;
                setSentences(testSentences);

                // Pre-generate first audio
                setLoadingMessage('Preparing audio...');
                if (testSentences.length > 0) {
                    await preloadAudio(testSentences[0]);
                    if (cancelled) return;

                    // Pre-fetch second
                    if (testSentences.length > 1) {
                        preloadAudio(testSentences[1]);
                    }
                }

                setPhase('test');
            } catch (error) {
                if (cancelled) return;
                console.error('Failed to initialize test:', error);
                setLoadingMessage('Error loading test. Please try again.');
            }
        };

        initTest();

        return () => {
            cancelled = true;
            stopAll();
        };
    }, [goalId, segmentIndex, segmentSubtitle, resetTest, stopAll, preloadAudio]);

    // Start learning phase
    const startLearning = async () => {
        setPhase('loading');
        setLoadingMessage('AI is creating lessons for your mistakes...');

        const testResults: TestResult[] = testResponses.map(r => ({
            sentence: r.sentence,
            understood: r.understood,
            replays: r.replays,
            reactionTimeMs: r.reactionTimeMs,
            markedWordIndices: r.markedIndices,
            // Include slider values for targeted lesson generation
            wordBoundaries: r.wordBoundaries,
            familiarity: r.familiarity,
            meaningClarity: r.meaningClarity,
        }));

        const generatedLessons = await generateSegmentLessons(
            testResults,
            segmentSubtitle,
            analysis!
        );
        setLessons(generatedLessons);
        setCurrentLessonIndex(0);
        setPhase('learning');
    };

    // Retake test
    const retakeTest = async () => {
        resetTest();

        setPhase('loading');
        setLoadingMessage('Generating new test questions...');

        // Get fresh profile
        let userProfile = {
            listeningLevel: 2,
            difficulties: [] as string[],
            weaknesses: analysis?.weaknesses || []
        };

        const profileRes = await fetch('/api/assessment/profile');
        if (profileRes.ok) {
            const profile = await profileRes.json();
            if (profile) {
                userProfile.listeningLevel = profile.listeningLevel || 2;
                userProfile.difficulties = profile.difficulties || [];
            }
        }

        const testSentences = await generateSegmentTestSentences(
            segmentSubtitle,
            userProfile,
            5
        );
        setSentences(testSentences);

        // Pre-generate first audio
        if (testSentences.length > 0) {
            await preloadAudio(testSentences[0]);
        }

        setPhase('test');
    };

    // Go to watch phase
    const goToWatch = () => {
        setPhase('watch');
    };

    // Extract marked words from test responses
    const extractMarkedWords = (): string[] => {
        const words: string[] = [];
        testResponses.forEach(resp => {
            const sentenceWords = resp.sentence.split(' ');
            resp.markedIndices.forEach(idx => {
                if (sentenceWords[idx]) {
                    words.push(sentenceWords[idx]);
                }
            });
        });
        return [...new Set(words)]; // Deduplicate
    };

    // Navigate to Audio Generator with test data
    const handleGoToAudioGenerator = () => {
        if (!onNavigateToAudioGenerator) return;

        const markedWords = extractMarkedWords();
        const testSentences = testResponses
            .filter(r => !r.understood)
            .map(r => r.sentence);

        onNavigateToAudioGenerator({
            markedWords,
            testSentences,
            aiFeedback: analysis?.summary || '',
            context: segmentSubtitle.join(' ')
        });
    };

    // Handle exit
    const handleExit = () => {
        stopAll();
        onExit();
    };

    // Mark segment as watched and complete
    const handleWatchComplete = async () => {
        try {
            await api.markSegmentWatched(goalId, segmentIndex);
        } catch (error) {
            console.error('Failed to mark watched:', error);
        }
        onComplete();
    };

    // Loading phase
    if (phase === 'loading') {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center max-w-sm">
                    <Loader2 size={48} className="animate-spin text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {loadingMessage}
                    </h2>
                </div>
            </div>
        );
    }

    // Analyzing phase
    if (phase === 'analyzing') {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center max-w-sm">
                    <Loader2 size={48} className="animate-spin text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Analyzing Your Results...
                    </h2>
                    <p className="text-gray-500">AI is evaluating your listening ability</p>
                </div>
            </div>
        );
    }

    // Results phase
    if (phase === 'results' && analysis) {
        const isMastered = testAccuracy >= 0.8;

        return (
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 p-6 overflow-auto">
                <div className="max-w-2xl mx-auto w-full">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={handleExit} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            <ArrowLeft size={20} />
                            Exit
                        </button>
                        <span className="text-sm text-gray-500">Segment {segmentIndex + 1} Test Results</span>
                    </div>

                    {/* Score Card */}
                    <div className={`rounded-2xl p-8 mb-6 ${isMastered ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30' : 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'}`}>
                        <div className="text-center">
                            {isMastered ? (
                                <Trophy size={64} className="mx-auto mb-4 text-green-500" />
                            ) : (
                                <Target size={64} className="mx-auto mb-4 text-yellow-500" />
                            )}
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                {Math.round(testAccuracy * 100)}% Accuracy
                            </h2>
                            <p className="text-lg text-gray-600 dark:text-gray-300">
                                {isMastered
                                    ? "Great job! You've mastered this segment!"
                                    : "Keep practicing to improve your listening!"}
                            </p>
                        </div>
                    </div>

                    {/* Analysis Summary */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-800">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <Zap size={18} className="text-yellow-500" />
                            AI Feedback
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">{analysis.summary}</p>

                        {analysis.weaknesses.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-gray-500 mb-2">Areas to Improve:</h4>
                                <ul className="space-y-1">
                                    {analysis.weaknesses.map((w, i) => (
                                        <li key={i} className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                                            <X size={14} /> {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3">
                        {/* Go to Audio Generator button */}
                        {onNavigateToAudioGenerator && (
                            <button
                                onClick={handleGoToAudioGenerator}
                                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-400 hover:to-amber-400 transition-all flex items-center justify-center gap-2"
                            >
                                <Volume2 size={20} />
                                Go to Audio Generator
                                {extractMarkedWords().length > 0 && (
                                    <span className="text-xs opacity-75">
                                        ({extractMarkedWords().length} words marked)
                                    </span>
                                )}
                            </button>
                        )}

                        {isMastered ? (
                            <button
                                onClick={goToWatch}
                                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all flex items-center justify-center gap-2"
                            >
                                <Eye size={20} />
                                Watch Video Segment
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={startLearning}
                                    className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <BookOpen size={20} />
                                    Start Learning Lessons
                                </button>
                                <button
                                    onClick={retakeTest}
                                    className="w-full py-3 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={18} />
                                    Retake Test
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Learning phase
    if (phase === 'learning' && lessons.length > 0) {
        const currentLesson = lessons[currentLessonIndex];

        return (
            <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                    <div className="max-w-2xl mx-auto w-full pb-8">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleExit} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <ArrowLeft size={20} />
                                Exit
                            </button>
                            <span className="text-sm text-gray-500">
                                Lesson {currentLessonIndex + 1} of {lessons.length}
                            </span>
                        </div>

                        {/* Lesson Card */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 mb-6 border border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                    <BookOpen size={20} className="text-yellow-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {currentLesson.content.title}
                                    </h2>
                                    <p className="text-sm text-gray-500">{currentLesson.type.replace('_', ' ')}</p>
                                </div>
                            </div>

                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                {currentLesson.content.description}
                            </p>

                            {/* Vocabulary lesson */}
                            {currentLesson.content.words && (
                                <div className="space-y-4">
                                    {currentLesson.content.words.map((word, i) => (
                                        <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                                                    {word.word}
                                                </span>
                                                {word.pronunciation && (
                                                    <span className="text-sm text-gray-500">/{word.pronunciation}/</span>
                                                )}
                                            </div>
                                            <p className="text-gray-700 dark:text-gray-300 mb-2">{word.meaning}</p>
                                            <p className="text-sm text-gray-500 italic">"{word.example}"</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Sentences for practice */}
                            {currentLesson.content.sentences && (
                                <div className="space-y-4">
                                    {currentLesson.content.sentences.map((sent, i) => (
                                        <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <p className="text-lg text-gray-900 dark:text-white mb-2">
                                                "{sent.original}"
                                            </p>
                                            {sent.explanation && (
                                                <p className="text-sm text-gray-500">{sent.explanation}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Patterns */}
                            {currentLesson.content.patterns && (
                                <div className="space-y-4">
                                    {currentLesson.content.patterns.map((pattern, i) => (
                                        <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <p className="font-semibold text-gray-900 dark:text-white mb-2">
                                                {pattern.pattern}
                                            </p>
                                            <ul className="space-y-1">
                                                {pattern.examples.map((ex, j) => (
                                                    <li key={j} className="text-sm text-gray-600 dark:text-gray-400">
                                                        • {ex}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <div className="flex gap-3">
                            {currentLessonIndex > 0 && (
                                <button
                                    onClick={() => setCurrentLessonIndex(prev => prev - 1)}
                                    className="px-6 py-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <ChevronRight size={20} className="rotate-180" />
                                    Previous
                                </button>
                            )}
                            {currentLessonIndex < lessons.length - 1 ? (
                                <button
                                    onClick={() => setCurrentLessonIndex(prev => prev + 1)}
                                    className="flex-1 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2"
                                >
                                    Next Lesson
                                    <ChevronRight size={20} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleGoToAudioGenerator}
                                    className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-400 hover:to-amber-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <Volume2 size={20} />
                                    Go to Audio Generator
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Summary phase (viewing completed lesson)
    if (phase === 'summary') {
        const latestTest = savedTests[0];

        return (
            <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                    <div className="max-w-2xl mx-auto w-full pb-8">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleExit} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <ArrowLeft size={20} />
                                Back to Course
                            </button>
                            <div className="flex items-center gap-2 text-green-500">
                                <Check size={20} />
                                <span className="font-medium">Completed</span>
                            </div>
                        </div>

                        {/* Lesson Title */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 mb-6 text-white">
                            <div className="flex items-center gap-3 mb-2">
                                <Trophy size={28} />
                                <h1 className="text-2xl font-bold">Lesson {segmentIndex + 1} Complete!</h1>
                            </div>
                            <p className="text-green-100">
                                You've mastered this segment. Here's your progress summary.
                            </p>
                        </div>

                        {/* Test Results Summary */}
                        {latestTest && (
                            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-800">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Target size={18} className="text-yellow-500" />
                                    Your Test Results
                                </h3>

                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div className="text-2xl font-bold text-green-500">{latestTest.accuracy}%</div>
                                        <div className="text-xs text-gray-500">Accuracy</div>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-500">{latestTest.score}/{latestTest.totalQuestions}</div>
                                        <div className="text-xs text-gray-500">Score</div>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div className="text-2xl font-bold text-purple-500">{mastery?.testAttempts || 1}</div>
                                        <div className="text-xs text-gray-500">Attempts</div>
                                    </div>
                                </div>

                                {/* Test Sentences */}
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-500 font-medium mb-2">Test Sentences:</p>
                                    {latestTest.responses.map((resp, i) => (
                                        <div key={i} className={`p-3 rounded-lg flex items-start gap-3 ${resp.understood
                                                ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30'
                                                : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
                                            }`}>
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${resp.understood ? 'bg-green-500' : 'bg-red-500'
                                                }`}>
                                                {resp.understood ? (
                                                    <Check size={12} className="text-white" />
                                                ) : (
                                                    <X size={12} className="text-white" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-900 dark:text-white">{resp.sentence}</p>
                                                {resp.replays > 0 && (
                                                    <p className="text-xs text-gray-500 mt-1">Replayed {resp.replays} time{resp.replays > 1 ? 's' : ''}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Analysis */}
                        {analysis && (
                            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-800">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Zap size={18} className="text-yellow-500" />
                                    AI Analysis
                                </h3>

                                {analysis.summary && (
                                    <p className="text-gray-600 dark:text-gray-300 mb-4">{analysis.summary}</p>
                                )}

                                {analysis.strengths && analysis.strengths.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">✓ Strengths</p>
                                        <ul className="space-y-1">
                                            {analysis.strengths.map((s, i) => (
                                                <li key={i} className="text-sm text-gray-600 dark:text-gray-400">• {s}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">△ Areas to Improve</p>
                                        <ul className="space-y-1">
                                            {analysis.weaknesses.map((w, i) => (
                                                <li key={i} className="text-sm text-gray-600 dark:text-gray-400">• {w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {analysis.recommendations && analysis.recommendations.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">💡 Recommendations</p>
                                        <ul className="space-y-1">
                                            {analysis.recommendations.map((r, i) => (
                                                <li key={i} className="text-sm text-gray-600 dark:text-gray-400">• {r}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Saved Lessons */}
                        {savedLessons.length > 0 && (
                            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-800">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <BookOpen size={18} className="text-yellow-500" />
                                    Your Lessons ({savedLessons.length})
                                </h3>

                                <div className="space-y-3">
                                    {savedLessons.map((lesson, i) => (
                                        <div key={lesson.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                                                    {lesson.type.replace('_', ' ')}
                                                </span>
                                                {lesson.completed && (
                                                    <Check size={14} className="text-green-500" />
                                                )}
                                            </div>
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {lesson.content.title}
                                            </p>
                                            {lesson.content.description && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                    {lesson.content.description}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={retakeTest}
                                className="flex-1 py-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={20} />
                                Practice Again
                            </button>
                            <button
                                onClick={() => setPhase('watch')}
                                className="flex-1 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2"
                            >
                                <Eye size={20} />
                                Watch Video
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Watch phase
    if (phase === 'watch') {
        return (
            <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto w-full pb-8">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleExit} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <ArrowLeft size={20} />
                                Exit
                            </button>
                            <span className="text-sm text-gray-500">Watch Segment {segmentIndex + 1}</span>
                        </div>

                        {/* Video Player */}
                        <div className="bg-black rounded-2xl overflow-hidden mb-6 aspect-video">
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(segmentStartTime)}&end=${Math.floor(segmentEndTime)}&autoplay=1`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>

                        {/* Instructions */}
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-800">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <Eye size={18} className="text-green-500" />
                                Watch Without Subtitles
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300">
                                You've practiced the vocabulary and patterns. Now watch this segment and see how much you can understand naturally!
                            </p>
                        </div>

                        {/* Complete Button */}
                        <button
                            onClick={handleWatchComplete}
                            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all flex items-center justify-center gap-2"
                        >
                            <Check size={20} />
                            Mark Complete & Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Test phase (main UI)
    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 p-6 overflow-auto">
            <div className="max-w-2xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={handleExit} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <ArrowLeft size={20} />
                        Exit
                    </button>
                    <span className="text-sm text-gray-500">
                        Question {currentIndex + 1} of {sentences.length}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${currentSentence?.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        currentSentence?.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                        {currentSentence?.difficulty}
                    </span>
                </div>

                {/* Progress */}
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-6">
                    <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all"
                        style={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
                    />
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 mb-6">
                    {!showTranscript ? (
                        <div className="text-center py-8">
                            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                                {isPlaying ? (
                                    <Volume2 size={48} className="text-yellow-500 animate-pulse" />
                                ) : (
                                    <Volume2 size={48} className="text-yellow-500" />
                                )}
                            </div>

                            {/* Audio Progress Bar */}
                            <div className="w-48 mx-auto mb-6">
                                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full bg-gradient-to-r from-yellow-500 to-orange-500 ${isPlaying ? '' : 'opacity-60'}`}
                                        style={{ width: `${audioProgress * 100}%` }}
                                    />
                                </div>
                            </div>

                            <p className="text-gray-500 dark:text-gray-400 mb-8">
                                Listen carefully, then reveal the transcript
                            </p>

                            {/* Audio Controls */}
                            <div className="flex items-center justify-center gap-3 mb-8">
                                <button
                                    onClick={handleReplay}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <RotateCcw size={18} />
                                    Replay
                                </button>
                                <button
                                    onClick={handleSlowPlay}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Play size={18} />
                                    0.7x Slow
                                </button>
                            </div>

                            <button
                                onClick={revealTranscript}
                                className="flex items-center gap-2 mx-auto px-6 py-3 bg-yellow-500 text-black font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
                            >
                                <Eye size={18} />
                                Show Transcript
                            </button>
                        </div>
                    ) : (
                        <div className="py-4">
                            <div className="mb-8">
                                <VocabularyBreakdown
                                    text={currentSentence?.sentence || ''}
                                    markedIndices={Array.from(markedIndices)}
                                    onToggleWord={toggleWordMark}
                                    onToggleRange={toggleWordRange}
                                    compact={false}
                                />
                            </div>

                            {/* Slider Panel for "Not Sure" */}
                            {showSliders ? (
                                <ListeningFeedbackSliders
                                    values={sliderValues}
                                    onChange={setSliderValues}
                                    onSubmit={handleSliderSubmit}
                                />
                            ) : (
                                /* Response Buttons */
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleResponse(true)}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                    >
                                        <Check size={20} />
                                        Understood
                                    </button>
                                    <button
                                        onClick={handleNotSure}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-xl font-semibold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                                    >
                                        <HelpCircle size={20} />
                                        Not Sure
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
