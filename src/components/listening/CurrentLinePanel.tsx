import React, { useState, useEffect } from 'react';
import { Play, Mic, Square, RefreshCw, Repeat } from 'lucide-react';
import VocabularyBreakdown from './VocabularyBreakdown';
import { FocusedSegment, Marker } from '../../types';
import { formatTime } from '../../utils';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface CurrentLinePanelProps {
  activeSegment: FocusedSegment | null;
  currentLineMarker: Marker | null;
  subtitlesVisible: boolean;
  onToggleWord: (segment: FocusedSegment | null, index: number) => void;
  onToggleRange: (segment: FocusedSegment | null, start: number, end: number) => void;
  onPlayNative: () => void;
}

export default function CurrentLinePanel({
  activeSegment,
  currentLineMarker,
  subtitlesVisible,
  onToggleWord,
  onToggleRange,
  onPlayNative,
}: CurrentLinePanelProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const {
    isRecording,
    recordingBlob,
    recordingUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  // Reset reveal state when segment changes
  useEffect(() => {
    setIsRevealed(false);
  }, [activeSegment?.subtitleId, activeSegment?.start]);

  // Reset reveal state when SUBS is turned ON globally
  useEffect(() => {
    if (subtitlesVisible) {
      setIsRevealed(false);
    }
  }, [subtitlesVisible]);

  // Reset recording when active segment changes
  useEffect(() => {
    if (!activeSegment || isRecording) return;
    if (recordingBlob || recordingUrl) resetRecording();
  }, [activeSegment, isRecording, recordingBlob, recordingUrl, resetRecording]);

  // Determine if text should be shown
  const shouldShowText = subtitlesVisible || isRevealed;

  const handleRecord = async () => {
    if (!activeSegment || isRecording) return;
    await startRecording();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Current Line Card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Current Line
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {activeSegment ? `${formatTime(activeSegment.start)} - ${formatTime(activeSegment.end)}` : 'No subtitle selected'}
            </p>
          </div>
        </div>

        {/* Word Breakdown - Fixed Height */}
        <div className="mt-3 h-24 overflow-y-auto">
          {activeSegment ? (
            shouldShowText ? (
              <VocabularyBreakdown
                text={activeSegment.text}
                markedIndices={currentLineMarker?.misunderstoodIndices || []}
                onToggleWord={(idx) => onToggleWord(activeSegment, idx)}
                onToggleRange={(start, end) => onToggleRange(activeSegment, start, end)}
                compact
              />
            ) : (
              <div
                onClick={() => setIsRevealed(true)}
                className="relative cursor-pointer rounded-lg bg-gray-100/50 dark:bg-gray-800/20 hover:bg-gray-100 dark:hover:bg-gray-800/40 p-3 transition-colors h-full flex items-center justify-center"
              >
                <span className="blur-md select-none text-gray-900 dark:text-gray-100 text-sm leading-relaxed">
                  {activeSegment.text}
                </span>
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 font-medium text-xs uppercase tracking-wider">
                  Click to Reveal
                </div>
              </div>
            )
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Play the video to see the current subtitle.</p>
          )}
        </div>

        {/* Controls */}
        <div className="mt-4 space-y-3">
          {/* Play/Loop Controls - Matching Loop mode design */}
          <div className="flex gap-2">
            {/* Main Action: Play Native */}
            <button
              onClick={onPlayNative}
              disabled={!activeSegment}
              className="flex-1 py-2 flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition-all bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={14} fill="currentColor" /> Replay
            </button>

            {/* Secondary Action: Loop (placeholder for future) */}
            <button
              disabled={!activeSegment}
              className="px-3 flex items-center justify-center rounded-lg transition-all border shadow-sm bg-white dark:bg-gray-800 text-gray-400 hover:text-yellow-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Loop Segment"
            >
              <Repeat size={16} />
            </button>
          </div>

          {/* Recording Controls */}
          <div className="flex gap-2">
            <button
              onClick={handleRecord}
              disabled={!activeSegment || isRecording}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all border shadow-sm ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 border-red-500/50 cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600 border-red-500 hover:border-red-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Mic size={14} />
              {isRecording ? 'Recording...' : 'Record Shadow'}
            </button>
            <button
              onClick={isRecording ? stopRecording : resetRecording}
              disabled={!activeSegment || (!isRecording && !recordingBlob)}
              className="px-3 flex items-center justify-center gap-1 rounded-lg text-sm transition-all bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRecording ? <Square size={14} /> : <RefreshCw size={14} />}
              {isRecording ? 'Stop' : 'Reset'}
            </button>
          </div>

          {/* Recording Playback */}
          {recordingUrl && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Your recording</p>
              <audio controls src={recordingUrl} className="w-full" />
            </div>
          )}

          {/* Recording Error */}
          {recorderError && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
              {recorderError}
            </p>
          )}
        </div>
      </div>

      {/* Spacer for layout consistency */}
      <div className="flex-1" />
    </div>
  );
}
