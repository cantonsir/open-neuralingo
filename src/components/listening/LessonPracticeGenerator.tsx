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
    Loader2,
    MessageSquare,
    BookOpen,
    Check,
    FileText,
    X,
    Users,
    Clock,
    Target,
    MapPin,
    Video,
    Plus,
    File,
    Star
} from 'lucide-react';
import { api, PracticeSession } from '../../db';
import { generateLessonPracticeDialogue } from '../../services/geminiService';
import { generateSpeech } from '../../services/ttsService';
import { Subtitle } from '../../types';
import { combineSubtitles } from '../../utils/subtitleGenerator';
import { getAudioDuration } from '../../utils/audioAnalyzer';
import PracticeInput from './PracticeInput';
import VideoContextExtractor, { type VideoContext } from './VideoContextExtractor';
import {
    handlePlanCommand,
    type GenerationPlan,
    type PracticeContext
} from '../../services/practiceCommandService';

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
    subtitles?: Subtitle[];
    durationSeconds: number;
    createdAt: number;
    isExpanded: boolean;
    isFavorite: boolean;
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

    // Plan preview state
    const [showPlanPreview, setShowPlanPreview] = useState(false);
    const [currentPlan, setCurrentPlan] = useState<GenerationPlan | null>(null);
    const [pendingPrompt, setPendingPrompt] = useState('');
    const [isPlanLoading, setIsPlanLoading] = useState(false);

    // Context attachment state
    const [showVideoExtractor, setShowVideoExtractor] = useState(false);
    const [attachedVideo, setAttachedVideo] = useState<VideoContext | null>(null);
    const [attachedPdf, setAttachedPdf] = useState<{ name: string; content: string } | null>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

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
                subtitles: s.subtitles,
                durationSeconds: s.durationSeconds || 0,
                createdAt: s.createdAt,
                isExpanded: false,
                isFavorite: s.isFavorite || false
            }));
            setDialogues(existingDialogues);
        } catch (error) {
            console.error('Failed to load practice sessions:', error);
        }
    };

    // Handle /plan command - generate a preview plan
    const handlePlanCommandSubmit = async (planPrompt: string) => {
        if (!planPrompt.trim()) {
            // If no prompt after /plan, use a generic prompt
            setPendingPrompt('Create a natural conversation');
        } else {
            setPendingPrompt(planPrompt);
        }

        setIsPlanLoading(true);
        setShowPlanPreview(true);

        try {
            const context: PracticeContext = {
                vocabulary,
                patterns,
                videoTranscript: segmentContext,
                description: `Lesson practice for segment ${segmentIndex}`
            };

            const plan = await handlePlanCommand(
                planPrompt || 'Create a natural conversation',
                vocabulary,
                patterns,
                context,
                isFastMode
            );

            setCurrentPlan(plan);
        } catch (error) {
            console.error('Failed to generate plan:', error);
            setShowPlanPreview(false);
            alert('Failed to generate plan. Please try again.');
        } finally {
            setIsPlanLoading(false);
        }
    };

    // Handle /fast command - toggle fast mode
    const handleFastToggle = () => {
        setIsFastMode(prev => !prev);
    };

    // Handle plan approval - generate dialogue from approved plan
    const handlePlanApproval = () => {
        setShowPlanPreview(false);
        setPrompt(pendingPrompt);
        // Trigger generation with the pending prompt
        handleGenerateWithPrompt(pendingPrompt);
    };

    // Handle plan cancellation
    const handlePlanCancel = () => {
        setShowPlanPreview(false);
        setCurrentPlan(null);
        setPendingPrompt('');
    };

    // Generate dialogue with a specific prompt (used after plan approval)
    const handleGenerateWithPrompt = async (targetPrompt: string) => {
        if (!targetPrompt.trim()) return;

        setIsGenerating(true);
        setGenerationProgress('Generating dialogue script...');

        try {
            // Build context from segment + attached contexts
            const contextData: {
                videoTranscript?: string;
                pdfContent?: string;
            } = {};

            // Add segment context
            if (segmentContext) {
                contextData.videoTranscript = segmentContext;
            }

            // Add attached video transcript (prioritize over segment context)
            if (attachedVideo?.transcript) {
                contextData.videoTranscript = attachedVideo.transcript;
            }

            // Add attached PDF content
            if (attachedPdf?.content) {
                contextData.pdfContent = attachedPdf.content;
            }

            const transcript = await generateLessonPracticeDialogue({
                prompt: targetPrompt.trim(),
                vocabulary,
                patterns,
                context: contextData,
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
            const allSubtitles: Subtitle[][] = [];
            const audioDurations: number[] = [];
            let totalDuration = 0;

            for (let i = 0; i < transcript.length; i++) {
                const line = transcript[i];
                setGenerationProgress(`Generating audio (${i + 1}/${transcript.length})...`);

                if (!speakerVoiceMap[line.speaker]) {
                    speakerVoiceMap[line.speaker] = availableVoices[nextVoiceIndex % availableVoices.length];
                    nextVoiceIndex++;
                }

                const voice = speakerVoiceMap[line.speaker];

                try {
                    const result = await generateSpeech({ text: line.text, voiceName: voice });
                    audioUrls.push(result.audioUrl);
                    
                    if (result.subtitles) {
                        allSubtitles.push(result.subtitles);
                    } else {
                        allSubtitles.push([]);
                    }
                    
                    // Measure duration for accurate timing
                    let duration = 0;
                    if (result.duration) {
                        duration = result.duration;
                    } else {
                        // Fallback measurement if not provided by TTS service
                        try {
                            duration = await getAudioDuration(result.audioUrl);
                        } catch (e) {
                            // Rough estimation fallback
                            const wordCount = line.text.split(' ').length;
                            duration = (wordCount / 150) * 60;
                        }
                    }
                    
                    audioDurations.push(duration);
                    totalDuration += duration;
                } catch (err) {
                    console.error('TTS error for line:', line.text, err);
                    audioUrls.push('');
                    allSubtitles.push([]);
                    audioDurations.push(0);
                }
            }

            // Combine subtitles
            const combinedSubtitles = combineSubtitles(allSubtitles, audioDurations);

            const dialogueId = `local-${Date.now()}`;
            const newDialogue: GeneratedDialogue = {
                id: dialogueId,
                prompt: targetPrompt.trim(),
                modelUsed: isFastMode ? 'gemini-2.0-flash-lite' : 'gemini-2.5-flash',
                transcript,
                audioUrls,
                subtitles: combinedSubtitles,
                durationSeconds: Math.round(totalDuration),
                createdAt: Date.now(),
                isExpanded: true,
                isFavorite: false
            };

            setDialogues(prev => [newDialogue, ...prev]);

            setGenerationProgress('Saving...');
            try {
                const result = await api.savePracticeSession(goalId, segmentIndex, {
                    prompt: targetPrompt.trim(),
                    modelUsed: newDialogue.modelUsed,
                    transcriptJson: transcript,
                    audioUrls: newDialogue.audioUrls,
                    subtitles: newDialogue.subtitles,
                    durationSeconds: newDialogue.durationSeconds
                });

                setDialogues(prev =>
                    prev.map(d => d.id === dialogueId ? { ...d, id: result.sessionId } : d)
                );
            } catch (saveError) {
                console.error('Failed to save practice session:', saveError);
            }

            setPrompt('');
            setPendingPrompt('');
            setCurrentPlan(null);
        } catch (error) {
            console.error('Generation failed:', error);
            alert('Failed to generate dialogue. Please try again.');
        } finally {
            setIsGenerating(false);
            setGenerationProgress('');
        }
    };

    // Handle direct submit (no command)
    const handleDirectSubmit = (submitPrompt: string) => {
        handleGenerateWithPrompt(submitPrompt);
    };

    // Handle video context extraction
    const handleVideoExtract = (video: VideoContext) => {
        setAttachedVideo(video);
        setShowVideoExtractor(false);
    };

    // Handle PDF upload
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // For now, read text files directly
            // PDF parsing would require a backend call or library like pdf.js
            if (file.name.endsWith('.txt')) {
                const text = await file.text();
                setAttachedPdf({
                    name: file.name,
                    content: text.slice(0, 5000) // Limit content length
                });
            } else if (file.name.endsWith('.pdf')) {
                // Upload to backend for text extraction
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    setAttachedPdf({
                        name: file.name,
                        content: result.text || result.content || ''
                    });
                } else {
                    alert('Failed to upload PDF. Please try again.');
                }
            }
        } catch (error) {
            console.error('Failed to process file:', error);
            alert('Failed to process file. Please try again.');
        }

        // Reset input
        if (pdfInputRef.current) {
            pdfInputRef.current.value = '';
        }
    };

    const toggleDialogueExpand = (dialogueId: string) => {
        setDialogues(prev =>
            prev.map(d => d.id === dialogueId ? { ...d, isExpanded: !d.isExpanded } : d)
        );
    };

    const handleToggleFavorite = async (dialogueId: string) => {
        try {
            const result = await api.togglePracticeFavorite(dialogueId);
            setDialogues(prev =>
                prev.map(d => d.id === dialogueId ? { ...d, isFavorite: result.isFavorite } : d)
            );
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
        }
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
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        {/* Vocabulary chip */}
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                            <BookOpen size={14} />
                            <span>Vocabulary: {vocabulary.length} words</span>
                        </div>

                        {/* Patterns chip */}
                        {patterns.length > 0 && (
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm">
                                <span>Patterns: {patterns.length}</span>
                            </div>
                        )}

                        {/* Attached Video chip */}
                        {attachedVideo && (
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm">
                                <Video size={14} />
                                <span className="max-w-[150px] truncate">{attachedVideo.title}</span>
                                <button
                                    onClick={() => setAttachedVideo(null)}
                                    className="ml-1 hover:text-red-900 dark:hover:text-red-200"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        {/* Attached PDF chip */}
                        {attachedPdf && (
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm">
                                <File size={14} />
                                <span className="max-w-[150px] truncate">{attachedPdf.name}</span>
                                <button
                                    onClick={() => setAttachedPdf(null)}
                                    className="ml-1 hover:text-green-900 dark:hover:text-green-200"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        {/* Add context buttons */}
                        <div className="flex items-center gap-1">
                            {!attachedVideo && (
                                <button
                                    onClick={() => setShowVideoExtractor(true)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                >
                                    <Plus size={12} />
                                    <Video size={12} />
                                    <span>Video</span>
                                </button>
                            )}
                            {!attachedPdf && (
                                <>
                                    <button
                                        onClick={() => pdfInputRef.current?.click()}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                    >
                                        <Plus size={12} />
                                        <File size={12} />
                                        <span>PDF</span>
                                    </button>
                                    <input
                                        ref={pdfInputRef}
                                        type="file"
                                        accept=".pdf,.txt"
                                        className="hidden"
                                        onChange={handlePdfUpload}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Input Section */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 mb-6">
                        {/* Fast Mode Toggle */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                            <span className="text-sm text-gray-500">Generation Mode</span>
                            <button
                                onClick={handleFastToggle}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isFastMode
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                <Zap size={14} className={isFastMode ? 'text-orange-500' : ''} />
                                {isFastMode ? 'Fast Mode: ON' : 'Fast Mode: OFF'}
                            </button>
                        </div>

                        {/* Practice Input with Command Support */}
                        <div className="p-4">
                            <PracticeInput
                                value={prompt}
                                onChange={setPrompt}
                                onSubmit={handleDirectSubmit}
                                onPlanCommand={handlePlanCommandSubmit}
                                onFastToggle={handleFastToggle}
                                isFastMode={isFastMode}
                                isGenerating={isGenerating}
                                placeholder="Describe the dialogue you want to practice...&#10;e.g., 'A conversation at a coffee shop'&#10;Use /plan to preview or /fast to toggle mode"
                            />

                            {/* Generation Progress */}
                            {isGenerating && (
                                <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                                    <Loader2 size={16} className="animate-spin" />
                                    {generationProgress || 'Generating...'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Plan Preview Modal */}
                    {showPlanPreview && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full shadow-2xl">
                                {/* Modal Header */}
                                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <FileText size={20} className="text-blue-500" />
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            Generation Plan
                                        </h3>
                                    </div>
                                    <button
                                        onClick={handlePlanCancel}
                                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Modal Content */}
                                <div className="p-4">
                                    {isPlanLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 size={32} className="animate-spin text-blue-500" />
                                            <span className="ml-3 text-gray-500">Analyzing your request...</span>
                                        </div>
                                    ) : currentPlan ? (
                                        <div className="space-y-4">
                                            {/* Summary */}
                                            <p className="text-gray-700 dark:text-gray-300 italic">
                                                "{currentPlan.summary}"
                                            </p>

                                            {/* Plan Details */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                    <Users size={16} className="text-purple-500" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Speakers</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {currentPlan.speakers.count} ({currentPlan.speakers.roles.join(', ')})
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                    <Clock size={16} className="text-green-500" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Duration</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {currentPlan.estimatedDuration}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                    <Target size={16} className="text-blue-500" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Vocabulary</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {currentPlan.vocabularyCoverage.percentage}% coverage
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                    <MapPin size={16} className="text-orange-500" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Setting</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                            {currentPlan.setting}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Patterns */}
                                            {currentPlan.patternsUsed.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-2">Patterns to practice:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentPlan.patternsUsed.map((pattern, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs"
                                                            >
                                                                {pattern}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Difficulty */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">Difficulty:</span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                    currentPlan.difficulty === 'beginner'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : currentPlan.difficulty === 'intermediate'
                                                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                    {currentPlan.difficulty}
                                                </span>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                {/* Modal Footer */}
                                <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={handlePlanCancel}
                                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handlePlanApproval}
                                        disabled={isPlanLoading || !currentPlan}
                                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Check size={16} />
                                        Generate
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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

                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleToggleFavorite(dialogue.id)}
                                                className={`p-2 transition-colors ${
                                                    dialogue.isFavorite
                                                        ? 'text-yellow-500 hover:text-yellow-600'
                                                        : 'text-gray-400 hover:text-yellow-500'
                                                }`}
                                                title={dialogue.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                            >
                                                <Star size={18} fill={dialogue.isFavorite ? 'currentColor' : 'none'} />
                                            </button>
                                            <button
                                                onClick={() => toggleDialogueExpand(dialogue.id)}
                                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                            >
                                                {dialogue.isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </div>
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

            {/* Video Context Extractor Modal */}
            {showVideoExtractor && (
                <VideoContextExtractor
                    onExtract={handleVideoExtract}
                    onClose={() => setShowVideoExtractor(false)}
                />
            )}
        </div>
    );
}
