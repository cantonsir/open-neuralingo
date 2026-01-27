import React, { useState } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { Play, Mic, Square, RefreshCw, ChevronLeft, ChevronRight, Volume2, Sparkles } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { Subtitle, PlayerState } from '../../types';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { analyzeShadowing, ShadowingResult } from '../../services/geminiService';

interface ShadowingViewProps {
  videoId: string;
  player: YouTubePlayer | null;
  onPlayerReady: (player: YouTubePlayer) => void;
  state: PlayerState;
  onStateChange: (state: Partial<PlayerState>) => void;
  currentSubtitle: Subtitle | null;
  subtitles: Subtitle[];
  onPrevSubtitle: () => void;
  onNextSubtitle: () => void;
  onPlaySegment: (start: number, end: number) => void;
}

export default function ShadowingView({
  videoId,
  player,
  onPlayerReady,
  state,
  onStateChange,
  currentSubtitle,
  subtitles,
  onPrevSubtitle,
  onNextSubtitle,
  onPlaySegment,
}: ShadowingViewProps) {
  const {
    isRecording,
    recordingBlob,
    recordingUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ShadowingResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handlePlayNative = () => {
    if (currentSubtitle) {
      onPlaySegment(currentSubtitle.start, currentSubtitle.end);
    } else if (player) {
      player.playVideo();
    }
  };

  const handleRecord = async () => {
    setAnalysis(null);
    setAnalysisError(null);
    await startRecording();
  };

  const handleAnalyze = async () => {
    if (!recordingBlob || !currentSubtitle) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await analyzeShadowing({
        text: currentSubtitle.text,
        learnerAudio: recordingBlob,
      });
      setAnalysis(result);
    } catch (e) {
      console.error('Shadowing analysis failed', e);
      setAnalysisError('Could not analyze recording. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!videoId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-50 to-yellow-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 px-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center">
            <Volume2 className="text-yellow-500" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Load a video to start shadowing</h2>
          <p className="text-gray-600 dark:text-gray-400">
            First open <strong>YouTube Practice</strong> and load a video. Then switch to <strong>Shadowing</strong> to
            practice repeating each line with AI feedback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <div className="flex flex-col lg:flex-row flex-1">
        {/* Left: Video + text */}
        <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
          <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 p-4">
            <VideoPlayer
              videoId={videoId}
              onReady={onPlayerReady}
              onStateChange={(s) => onStateChange({ ...state, ...s })}
              currentSubtitle={currentSubtitle}
              playbackRate={state.playbackRate}
              forceShowSubtitle={true}
            />
          </div>

          <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Current Line
              </h2>

              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <button
                  onClick={onPrevSubtitle}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  onClick={onNextSubtitle}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="min-h-[64px] flex items-center">
              <p className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white text-center w-full">
                {currentSubtitle ? currentSubtitle.text : 'No subtitle selected.'}
              </p>
            </div>

            {currentSubtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {currentSubtitle.start.toFixed(2)}s – {currentSubtitle.end.toFixed(2)}s
              </p>
            )}
          </div>
        </div>

        {/* Right: Shadowing controls + feedback */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="text-yellow-500" size={18} />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Shadowing Coach</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            1) Listen to the native audio. 2) Record your voice. 3) Get AI feedback on pronunciation, rhythm, and
            intonation.
          </p>

          {/* Controls */}
          <div className="space-y-3">
            <button
              onClick={handlePlayNative}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <Play size={16} />
              Play Native
            </button>

            <div className="flex gap-2">
              <button
                onClick={isRecording ? undefined : handleRecord}
                disabled={isRecording}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isRecording
                    ? 'bg-red-400/40 text-red-100 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                <Mic size={16} />
                {isRecording ? 'Recording...' : 'Record Shadow'}
              </button>
              <button
                onClick={isRecording ? stopRecording : resetRecording}
                disabled={!isRecording && !recordingBlob}
                className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-sm"
              >
                {isRecording ? <Square size={14} /> : <RefreshCw size={14} />}
                {isRecording ? 'Stop' : 'Reset'}
              </button>
            </div>

            {recordingUrl && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Your recording</p>
                <audio controls src={recordingUrl} className="w-full" />
              </div>
            )}

            {recorderError && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                {recorderError}
              </p>
            )}
          </div>

          {/* AI Feedback */}
          <div className="mt-4 flex-1 flex flex-col">
            <button
              onClick={handleAnalyze}
              disabled={!recordingBlob || !currentSubtitle || isAnalyzing}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed hover:from-yellow-400 hover:to-orange-400 transition-colors"
            >
              <Sparkles size={16} />
              {isAnalyzing ? 'Analyzing...' : 'Get AI Feedback'}
            </button>

            {analysisError && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mb-2">
                {analysisError}
              </p>
            )}

            {analysis ? (
              <div className="flex-1 rounded-2xl bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800 p-4 space-y-3 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Feedback</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-2 border border-gray-200 dark:border-gray-800">
                    <div className="text-[10px] text-gray-500 mb-1">Pronunciation</div>
                    <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                      {analysis.pronunciationScore}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-2 border border-gray-200 dark:border-gray-800">
                    <div className="text-[10px] text-gray-500 mb-1">Rhythm</div>
                    <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                      {analysis.rhythmScore}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-2 border border-gray-200 dark:border-gray-800">
                    <div className="text-[10px] text-gray-500 mb-1">Intonation</div>
                    <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                      {analysis.intonationScore}
                    </div>
                  </div>
                </div>

                {analysis.summary && (
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{analysis.summary}</p>
                )}

                {analysis.wordLevelFeedback?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">Key words</p>
                    <ul className="space-y-1">
                      {analysis.wordLevelFeedback.slice(0, 5).map((w, idx) => (
                        <li
                          key={`${w.word}-${idx}`}
                          className="text-[11px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1"
                        >
                          <span className="font-semibold">{w.word}</span>{' '}
                          <span className="text-gray-500 dark:text-gray-400">({w.issueType})</span>: {w.note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 rounded-2xl bg-gray-50 dark:bg-gray-950/40 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 text-center px-4">
                Record a shadowing attempt and tap <strong className="mx-1">Get AI Feedback</strong> to see detailed
                coaching.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

