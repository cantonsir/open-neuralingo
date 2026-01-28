import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft,
    Play,
    Pause,
    RotateCcw,
    Volume2,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Zap,
    Send,
    Loader2,
    MessageSquare,
    BookOpen,
    Check
} from 'lucide-react';
import { api, PracticeSession } from '../../db';
import { generateLessonPracticeDialogue } from '../../services/geminiService';
import { generateSpeech } from '../../services/ttsService';

interface LessonPracticeGeneratorProps {
    goalId: string;
    segmentIndex: number;
    vocabulary: string[];
    patterns: string[];
    segmentContext: string;
    onComplete: () => void;
    onBack: () => void;
    onExit: () => void;
}

interface GeneratedDialogue {
    id: string;
    prompt: string;
    modelUsed: string;
    transcript: { speaker: string; text: string }[];
    audioUrls: string[];
    durationSeconds: number;
    createdAt: number;
    isExpanded: boolean;
}

export default function LessonPracticeGenerator({
    goalId,
    segmentIndex,
    vocabulary,
    patterns,
    segmentContext,
    onComplete,
    onBack,
    onExit
}: LessonPracticeGeneratorProps) {
    // Input state
    const [prompt, setPrompt] = useState('');
    const [isFastMode, setIsFastMode] = useState(false);

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState('');

    // Dialogues state
    const [dialogues, setDialogues] = useState<GeneratedDialogue[]>([]);
    const [savedSessions, setSavedSessions] = useState<PracticeSession[]>([]);

    // Audio playback state
    const [playingDialogueId, setPlayingDialogueId] = useState<string | null>(null);
    const [playingLineIndex, setPlayingLineIndex] = useState<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Load existing practice sessions on mount
    useEffect(() => {
        loadExistingSessions();
    }, [goalId, segmentIndex]);

    const loadExistingSessions = async () => {
        try {
            const sessions = await api.getPracticeSessions(goalId, segmentIndex);
            setSavedSessions(sessions);

            // Convert saved sessions to GeneratedDialogue format
            const existingDialogues: GeneratedDialogue[] = sessions.map(s => ({
                id: s.id,
                prompt: s.prompt,
                modelUsed: s.modelUsed,
                transcript: s.transcript,
                audioUrls: s.audioUrls || [],
                durationSeconds: s.durationSeconds || 0,
                createdAt: s.createdAt,
                isExpanded: false
            }));
            setDialogues(existingDialogues);
        } catch (error) {
            console.error('Failed to load practice sessions:', error);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            return;
        }

        setIsGenerating(true);
        setGenerationProgress('Generating dialogue script...');

        try {
            // Generate dialogue script
            const transcript = await generateLessonPracticeDialogue({
                prompt: prompt.trim(),
                vocabulary,
                patterns,
                context: { videoTranscript: segmentContext },
                isFastMode
            });

            if (transcript.length === 0) {
                alert('Failed to generate dialogue. Please try again.');
                setIsGenerating(false);
                return;
            }

            setGenerationProgress('Generating audio (0/' + transcript.length + ')...');

            // Generate audio for each line with voice assignment
            const availableVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];
            const speakerVoiceMap: { [speaker: string]: string } = {};
            let nextVoiceIndex = 0;
            const audioUrls: string[] = [];
            let totalDuration = 0;

            for (let i = 0; i < transcript.length; i++) {
                const line = transcript[i];
                setGenerationProgress(`Generating audio (${i + 1}/${transcript.length})...`);

                // Assign voice to speaker if not already assigned
                if (!speakerVoiceMap[line.speaker]) {
                    speakerVoiceMap[line.speaker] = availableVoices[nextVoiceIndex % availableVoices.length];
                    nextVoiceIndex++;
                }

                const voice = speakerVoiceMap[line.speaker];

                try {
                    const audioUrl = await generateSpeech({ text: line.text, voiceName: voice });
                    audioUrls.push(audioUrl);
                    // Estimate duration
                    const wordCount = line.text.split(' ').length;
                    totalDuration += (wordCount / 150) * 60;
                } catch (err) {
                    console.error('TTS error for line:', line.text, err);
                    audioUrls.push(''); // Empty URL for failed generation
                }
            }

            const dialogueId = `local-${Date.now()}`;
            const newDialogue: GeneratedDialogue = {
                id: dialogueId,
                prompt: prompt.trim(),
                modelUsed: isFastMode ? 'gemini-2.0-flash-fast' : 'gemini-2.0-flash',
                transcript,
                audioUrls,
                durationSeconds: Math.round(totalDuration),
                createdAt: Date.now(),
                isExpanded: true
            };

            // Add to dialogues list
            setDialogues(prev => [newDialogue, ...prev]);

            // Save to database
            setGenerationProgress('Saving...');
            try {
                const result = await api.savePracticeSession(goalId, segmentIndex, {
                    prompt: prompt.trim(),
                    modelUsed: newDialogue.modelUsed,
                    transcriptJson: transcript,
                    durationSeconds: newDialogue.durationSeconds
                });

                // Update dialogue with saved ID
                setDialogues(prev =>
                    prev.map(d => d.id === dialogueId ? { ...d, id: result.sessionId } : d)
                );
            } catch (saveError) {
                console.error('Failed to save practice session:', saveError);
            }

            // Clear prompt
            setPrompt('');
        } catch (error) {
            console.error('Generation failed:', error);
            alert('Failed to generate dialogue. Please try again.');
        } finally {
            setIsGenerating(false);
            setGenerationProgress('');
        }
    };

    const toggleDialogueExpand = (dialogueId: string) => {
        setDialogues(prev =>
            prev.map(d => d.id === dialogueId ? { ...d, isExpanded: !d.isExpanded } : d)
        );
    };

    const playDialogue = (dialogue: GeneratedDialogue, startIndex: number = 0) => {
        // Stop any current playback
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        if (dialogue.audioUrls.length === 0 || startIndex >= dialogue.audioUrls.length) {
            return;
        }

        setPlayingDialogueId(dialogue.id);
        setPlayingLineIndex(startIndex);

        playLine(dialogue, startIndex);
    };

    const playLine = (dialogue: GeneratedDialogue, lineIndex: number) => {
        if (lineIndex >= dialogue.audioUrls.length || !dialogue.audioUrls[lineIndex]) {
            // End of dialogue or empty URL
            setPlayingDialogueId(null);
            setPlayingLineIndex(0);
            return;
        }

        const audio = new Audio(dialogue.audioUrls[lineIndex]);
        audioRef.current = audio;

        audio.onended = () => {
            // Play next line
            const nextIndex = lineIndex + 1;
            if (nextIndex < dialogue.audioUrls.length) {
                setPlayingLineIndex(nextIndex);
                playLine(dialogue, nextIndex);
            } else {
                // End of dialogue
                setPlayingDialogueId(null);
                setPlayingLineIndex(0);
            }
        };

        audio.onerror = () => {
            console.error('Audio playback error');
            setPlayingDialogueId(null);
            setPlayingLineIndex(0);
        };

        audio.play().catch(err => {
            console.error('Failed to play audio:', err);
            setPlayingDialogueId(null);
        });
    };

    const stopPlayback = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPlayingDialogueId(null);
        setPlayingLineIndex(0);
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const hasGeneratedDialogues = dialogues.length > 0;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto w-full pb-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={onExit}
                            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <ArrowLeft size={20} />
                            Exit
                        </button>
                        <div className="flex items-center gap-2">
                            <MessageSquare size={18} className="text-yellow-500" />
                            <span className="text-sm text-gray-500">Practice Generator</span>
                        </div>
                    </div>

                    {/* Title Card */}
                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl p-6 mb-6 border border-yellow-500/30">
                        <div className="flex items-center gap-3 mb-2">
                            <Volume2 size={24} className="text-yellow-500" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Practice with AI Dialogue
                            </h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">
                            Generate custom listening practice dialogues using vocabulary and patterns from your lessons.
                        </p>
                    </div>

                    {/* Context Chips */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                            <BookOpen size={14} />
                            <span>Vocabulary: {vocabulary.length} words</span>
                        </div>
                        {patterns.length > 0 && (
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm">
                                <span>Patterns: {patterns.length}</span>
                            </div>
                        )}
                    </div>

                    {/* Input Section */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 mb-6">
                        {/* Fast Mode Toggle */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                            <span className="text-sm text-gray-500">Generation Mode</span>
                            <button
                                onClick={() => setIsFastMode(!isFastMode)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isFastMode
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                <Zap size={14} className={isFastMode ? 'text-orange-500' : ''} />
                                {isFastMode ? 'Fast Mode: ON' : 'Fast Mode: OFF'}
                            </button>
                        </div>

                        {/* Prompt Input */}
                        <div className="p-4">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe the dialogue you want to practice...&#10;e.g., 'A conversation at a coffee shop about ordering drinks'"
                                className="w-full h-24 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                disabled={isGenerating}
                            />

                            {/* Generate Button */}
                            <div className="flex justify-end mt-3">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !prompt.trim()}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            {generationProgress || 'Generating...'}
                                        </>
                                    ) : (
                                        <>
                                            <Send size={18} />
                                            Generate Dialogue
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Generated Dialogues */}
                    {dialogues.length > 0 && (
                        <div className="space-y-4 mb-6">
                            <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <Volume2 size={16} />
                                Generated Dialogues ({dialogues.length})
                            </h3>

                            {dialogues.map((dialogue, idx) => (
                                <div
                                    key={dialogue.id}
                                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                                >
                                    {/* Dialogue Header */}
                                    <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => {
                                                    if (playingDialogueId === dialogue.id) {
                                                        stopPlayback();
                                                    } else {
                                                        playDialogue(dialogue);
                                                    }
                                                }}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${playingDialogueId === dialogue.id
                                                    ? 'bg-yellow-500 text-white'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {playingDialogueId === dialogue.id ? (
                                                    <Pause size={18} />
                                                ) : (
                                                    <Play size={18} />
                                                )}
                                            </button>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                    Dialogue #{dialogues.length - idx}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDuration(dialogue.durationSeconds)} • {dialogue.transcript.length} lines
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => toggleDialogueExpand(dialogue.id)}
                                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        >
                                            {dialogue.isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                    </div>

                                    {/* Dialogue Content (Expanded) */}
                                    {dialogue.isExpanded && (
                                        <div className="p-4 space-y-3">
                                            {/* Prompt */}
                                            <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                                Prompt: "{dialogue.prompt}"
                                            </div>

                                            {/* Transcript */}
                                            {dialogue.transcript.map((line, lineIdx) => (
                                                <div
                                                    key={lineIdx}
                                                    className={`flex gap-3 p-2 rounded-lg transition-colors ${playingDialogueId === dialogue.id && playingLineIndex === lineIdx
                                                        ? 'bg-yellow-50 dark:bg-yellow-900/20'
                                                        : ''
                                                        }`}
                                                >
                                                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">
                                                        {line.speaker}
                                                    </span>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                                        {line.text}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {dialogues.length === 0 && !isGenerating && (
                        <div className="text-center py-12">
                            <Volume2 size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                            <p className="text-gray-500 dark:text-gray-400 mb-2">
                                No practice dialogues yet
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                                Enter a prompt above to generate your first dialogue
                            </p>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onBack}
                            className="px-6 py-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                        >
                            <ChevronRight size={20} className="rotate-180" />
                            Back to Lessons
                        </button>
                        <button
                            onClick={onComplete}
                            disabled={!hasGeneratedDialogues}
                            className={`flex-1 py-4 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${hasGeneratedDialogues
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-400 hover:to-emerald-400'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            <Check size={20} />
                            Continue to Watch Video
                        </button>
                    </div>

                    {!hasGeneratedDialogues && (
                        <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-3">
                            Generate at least one dialogue to continue
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
