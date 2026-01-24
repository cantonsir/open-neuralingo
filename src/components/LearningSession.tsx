import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, ChevronDown, ChevronUp, Check, X, Loader2 } from 'lucide-react';
import { api, LessonItem } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface LearningSessionProps {
    videoId: string;
    transcriptSegments: string[][];  // Array of segments, each segment is array of sentences
    segmentDuration: number;  // Duration in minutes (default 4)
    onExit: () => void;
}

const LearningSession: React.FC<LearningSessionProps> = ({
    videoId,
    transcriptSegments,
    segmentDuration = 4,
    onExit,
}) => {
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [lessons, setLessons] = useState<LessonItem[]>([]);
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showText, setShowText] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [sessionStats, setSessionStats] = useState({ total: 0, understood: 0 });

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentLesson = lessons[currentLessonIndex];
    const segmentProgress = lessons.length > 0
        ? Math.round((currentLessonIndex / lessons.length) * 100)
        : 0;

    // Initialize or load lessons for current segment
    useEffect(() => {
        const loadOrGenerateLessons = async () => {
            if (!videoId || !transcriptSegments[currentSegmentIndex]) return;

            setIsGenerating(true);
            try {
                // Try to fetch existing lessons
                let fetchedLessons = await api.fetchLessons(videoId, currentSegmentIndex);

                if (fetchedLessons.length === 0) {
                    // Generate new lessons from transcript
                    const sentences = transcriptSegments[currentSegmentIndex];
                    await api.generateLessons(videoId, currentSegmentIndex, sentences);
                    fetchedLessons = await api.fetchLessons(videoId, currentSegmentIndex);
                }

                setLessons(fetchedLessons);
                setCurrentLessonIndex(0);
                setShowText(false);
            } catch (error) {
                console.error('Failed to load lessons:', error);
            } finally {
                setIsGenerating(false);
            }
        };

        loadOrGenerateLessons();
    }, [videoId, currentSegmentIndex, transcriptSegments]);

    // Generate TTS audio for current lesson using Gemini
    const generateAudio = useCallback(async (text: string) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('VITE_GEMINI_API_KEY not set');
            return null;
        }

        setIsLoadingAudio(true);
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

            // Using Gemini's text generation to create a spoken version
            // Note: For actual TTS, you might need to use a different API
            const response = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{ text: `Speak this text naturally: "${text}"` }]
                }],
            });

            // For now, we'll use browser's built-in TTS as fallback
            // until Gemini audio API is fully available
            return null;
        } catch (error) {
            console.error('Audio generation error:', error);
            return null;
        } finally {
            setIsLoadingAudio(false);
        }
    }, []);

    // Use browser TTS as fallback
    const speakText = useCallback((text: string, rate: number = 1.0) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = rate;
            utterance.lang = 'en-US';

            // Try to get a natural voice
            const voices = window.speechSynthesis.getVoices();
            const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural'))
                || voices.find(v => v.lang.startsWith('en'));
            if (englishVoice) {
                utterance.voice = englishVoice;
            }

            utterance.onstart = () => setIsPlaying(true);
            utterance.onend = () => setIsPlaying(false);

            window.speechSynthesis.speak(utterance);
        }
    }, []);

    // Play current lesson audio
    const handlePlay = useCallback(() => {
        if (!currentLesson) return;

        if (audioUrl && audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.play();
            setIsPlaying(true);
        } else {
            // Fallback to browser TTS
            speakText(currentLesson.originalText, playbackSpeed);
        }
    }, [currentLesson, audioUrl, playbackSpeed, speakText]);

    // Stop playback
    const handleStop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    }, []);

    // Record user response
    const handleResponse = async (understood: boolean) => {
        if (!currentLesson) return;

        try {
            await api.updateLessonProgress(currentLesson.id, understood);

            setSessionStats(prev => ({
                total: prev.total + 1,
                understood: prev.understood + (understood ? 1 : 0)
            }));

            // Move to next lesson
            if (currentLessonIndex < lessons.length - 1) {
                setCurrentLessonIndex(prev => prev + 1);
                setShowText(false);
                handleStop();
            } else {
                // Segment complete - could show summary or move to next segment
                console.log('Segment complete!');
            }
        } catch (error) {
            console.error('Failed to update progress:', error);
        }
    };

    // Replay at slower speed
    const handleSlowReplay = () => {
        setPlaybackSpeed(0.75);
        handlePlay();
    };

    if (isGenerating) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
                <Loader2 className="w-12 h-12 animate-spin text-blue-400 mb-4" />
                <h2 className="text-xl font-semibold">Preparing Learning Session...</h2>
                <p className="text-slate-400 mt-2">Generating lessons from video transcript</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <button
                    onClick={onExit}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Exit
                </button>
                <div className="text-center">
                    <h1 className="text-lg font-semibold">Learning Session</h1>
                    <p className="text-sm text-slate-400">
                        Segment {currentSegmentIndex + 1} of {transcriptSegments.length}
                    </p>
                </div>
                <div className="text-right text-sm">
                    <span className="text-green-400">{sessionStats.understood}</span>
                    <span className="text-slate-500"> / </span>
                    <span className="text-slate-300">{sessionStats.total}</span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="px-4 py-2">
                <div className="flex items-center justify-between text-sm text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{segmentProgress}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${segmentProgress}%` }}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                {currentLesson ? (
                    <>
                        {/* Audio Player Area */}
                        <div className="w-full max-w-md bg-slate-800/50 rounded-2xl p-8 backdrop-blur-sm border border-slate-700">
                            <div className="flex flex-col items-center">
                                {/* Audio indicator */}
                                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all ${isPlaying
                                        ? 'bg-blue-500/20 animate-pulse'
                                        : 'bg-slate-700/50'
                                    }`}>
                                    <Volume2 className={`w-12 h-12 ${isPlaying ? 'text-blue-400' : 'text-slate-500'}`} />
                                </div>

                                {/* Play controls */}
                                <div className="flex items-center gap-4 mb-6">
                                    <button
                                        onClick={handlePlay}
                                        disabled={isLoadingAudio}
                                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-medium transition-colors disabled:opacity-50"
                                    >
                                        {isLoadingAudio ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : isPlaying ? (
                                            <Pause className="w-5 h-5" />
                                        ) : (
                                            <Play className="w-5 h-5" />
                                        )}
                                        {isPlaying ? 'Playing...' : 'Play'}
                                    </button>

                                    <button
                                        onClick={handleSlowReplay}
                                        className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-full text-sm transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        0.75x
                                    </button>
                                </div>

                                {/* Item counter */}
                                <p className="text-slate-500 text-sm">
                                    Item {currentLessonIndex + 1} of {lessons.length}
                                </p>
                            </div>
                        </div>

                        {/* Response Buttons */}
                        <div className="mt-8 flex flex-col items-center gap-4">
                            <p className="text-slate-300 font-medium">Did you understand?</p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => handleResponse(true)}
                                    className="flex items-center gap-2 px-8 py-4 bg-green-600/20 hover:bg-green-600/40 border border-green-500/50 rounded-xl text-green-400 font-medium transition-all hover:scale-105"
                                >
                                    <Check className="w-5 h-5" />
                                    Yes
                                </button>
                                <button
                                    onClick={() => handleResponse(false)}
                                    className="flex items-center gap-2 px-8 py-4 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 rounded-xl text-red-400 font-medium transition-all hover:scale-105"
                                >
                                    <X className="w-5 h-5" />
                                    No
                                </button>
                            </div>
                        </div>

                        {/* Hint Ladder - Show Text */}
                        <div className="mt-8">
                            <button
                                onClick={() => setShowText(!showText)}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                {showText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                {showText ? 'Hide text' : 'Show text (hint)'}
                            </button>

                            {showText && (
                                <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700 max-w-md">
                                    <p className="text-lg text-white">{currentLesson.originalText}</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center text-slate-400">
                        <p>No lessons available for this segment.</p>
                        <p className="text-sm mt-2">Make sure the video has subtitles.</p>
                    </div>
                )}
            </div>

            {/* Hidden audio element */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                />
            )}
        </div>
    );
};

export default LearningSession;
