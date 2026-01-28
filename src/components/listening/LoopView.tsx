import React, { useEffect, useMemo, useRef } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { Play, Mic, Square, RefreshCw, ChevronLeft, ChevronRight, List } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import Timeline from './Timeline';
import MarkerList from './MarkerList';
import VideoControls from './VideoControls';
import VideoUrlInput from './VideoUrlInput';
import VocabularyBreakdown from './VocabularyBreakdown';
import { api } from '../../db';
import { FocusedSegment, Marker, Subtitle, PlayerState, TagType } from '../../types';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface LoopViewProps {
  // Video state
  videoId: string;
  videoTitle: string;
  inputUrl: string;
  setInputUrl: (url: string) => void;
  isFetchingSubs: boolean;
  onLoadVideo: () => void;
  
  // Player state
  player: YouTubePlayer | null;
  onPlayerReady: (player: YouTubePlayer) => void;
  onStateChange: (state: Partial<PlayerState>) => void;
  state: PlayerState;
  
  // Subtitles
  currentSubtitle: Subtitle | null;
  subtitles: Subtitle[];
  subtitlesVisible: boolean;
  isPeekingSubs: boolean;
  setSubtitlesVisible: (visible: boolean) => void;
  focusedSegment: FocusedSegment | null;
  
  // Markers
  markers: Marker[];
  currentLoopId: string | null;
  onPlayLoop: (marker: Marker) => void;
  onStopLoop: () => void;
  onDeleteMarker: (id: string) => void;
  onAddTag: (id: string, tag: TagType) => void;
  onRemoveTag: (id: string, tag: TagType) => void;
  onToggleWord: (id: string, wordIndex: number) => void;
  onToggleRange: (id: string, start: number, end: number) => void;
  onPlayOnce: (start: number, end: number) => void;
  
  // Controls
  onPlayPause: () => void;
  onPrevSubtitle: () => void;
  onNextSubtitle: () => void;
  onChangePlaybackRate: (rate: number) => void;
  onSeek: (time: number) => void;
  onFocusSegment: (segment: FocusedSegment | null) => void;
  onShadowSegment: (segment: FocusedSegment) => void;
  onToggleSegmentWord: (segment: FocusedSegment | null, index: number) => void;
  onToggleSegmentRange: (segment: FocusedSegment | null, start: number, end: number) => void;
}

export default function LoopView({
  videoId,
  videoTitle,
  inputUrl,
  setInputUrl,
  isFetchingSubs,
  onLoadVideo,
  player,
  onPlayerReady,
  onStateChange,
  state,
  currentSubtitle,
  subtitles,
  subtitlesVisible,
  isPeekingSubs,
  setSubtitlesVisible,
  focusedSegment,
  markers,
  currentLoopId,
  onPlayLoop,
  onStopLoop,
  onDeleteMarker,
  onAddTag,
  onRemoveTag,
  onToggleWord,
  onToggleRange,
  onPlayOnce,
  onPlayPause,
  onPrevSubtitle,
  onNextSubtitle,
  onChangePlaybackRate,
  onSeek,
  onFocusSegment,
  onShadowSegment,
  onToggleSegmentWord,
  onToggleSegmentRange,
}: LoopViewProps) {
  const [feedbackStatus, setFeedbackStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isReviewCollapsed, setIsReviewCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('listeningReviewCollapsed') === 'true';
  });
  const [isShadowingEnabled, setIsShadowingEnabled] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('listeningShadowingEnabled') === 'true';
  });
  const currentLineRef = useRef<HTMLDivElement>(null);
  const {
    isRecording,
    recordingBlob,
    recordingUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  const activeSegment = useMemo(() => {
    if (focusedSegment && focusedSegment.text.trim()) return focusedSegment;
    if (!currentSubtitle) return null;
    return {
      start: currentSubtitle.start,
      end: currentSubtitle.end,
      text: currentSubtitle.text,
      subtitleId: currentSubtitle.id,
    };
  }, [focusedSegment, currentSubtitle]);

  const currentLineMarker = useMemo(() => {
    if (!activeSegment) return null;
    if (activeSegment.subtitleId) {
      const direct = markers.find(marker => marker.id === activeSegment.subtitleId);
      if (direct) return direct;
    }

    return markers.find(
      marker => Math.abs(marker.start - activeSegment.start) < 0.1 && Math.abs(marker.end - activeSegment.end) < 0.1
    ) || null;
  }, [activeSegment, markers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('listeningReviewCollapsed', String(isReviewCollapsed));
  }, [isReviewCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('listeningShadowingEnabled', String(isShadowingEnabled));
  }, [isShadowingEnabled]);

  useEffect(() => {
    if (!activeSegment || isRecording) return;
    if (recordingBlob || recordingUrl) resetRecording();
  }, [activeSegment, isRecording, recordingBlob, recordingUrl, resetRecording]);

  const canGenerateFeedback = markers.length > 0 && !!videoId;

  const handleGenerateFeedback = async () => {
    if (!canGenerateFeedback) return;
    setFeedbackStatus('saving');

    try {
      await api.saveListeningFeedbackSession({
        videoId,
        videoTitle: videoTitle || `YouTube Video (${videoId})`,
        markers,
        createdAt: Date.now(),
      });

      setFeedbackStatus('saved');
      window.setTimeout(() => {
        setFeedbackStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to save feedback session:', error);
      setFeedbackStatus('error');
    }
  };

  const handlePlayNative = () => {
    if (!activeSegment) return;
    onPlayOnce(activeSegment.start, activeSegment.end);
  };

  const handleRecord = async () => {
    if (!activeSegment || isRecording) return;
    await startRecording();
  };

  const handlePrevLine = () => {
    onFocusSegment(null);
    onPrevSubtitle();
  };

  const handleNextLine = () => {
    onFocusSegment(null);
    onNextSubtitle();
  };

  const handleShadowFromMarker = (segment: FocusedSegment) => {
    onShadowSegment(segment);
    setIsShadowingEnabled(true);
    currentLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* URL Input Bar */}
      <VideoUrlInput
        inputUrl={inputUrl}
        setInputUrl={setInputUrl}
        isFetchingSubs={isFetchingSubs}
        onLoadVideo={onLoadVideo}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Empty State */}
        {!videoId ? (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-50 to-yellow-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Video Loaded</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Paste a YouTube URL above and click <strong>Load Video</strong> to start practicing.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Video Area */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              {/* Video Container */}
              <div className="flex-1 flex flex-col justify-center min-h-0">
                <VideoPlayer
                  videoId={videoId}
                  onReady={onPlayerReady}
                  onStateChange={onStateChange}
                  currentSubtitle={currentSubtitle}
                  playbackRate={state.playbackRate}
                  forceShowSubtitle={subtitlesVisible || isPeekingSubs}
                />

                <Timeline
                  duration={state.duration}
                  currentTime={state.currentTime}
                  markers={markers}
                  onSeek={onSeek}
                />

              </div>

              {/* Controls */}
              <VideoControls
                isPlaying={state.isPlaying}
                currentTime={state.currentTime}
                duration={state.duration}
                playbackRate={state.playbackRate}
                subtitlesVisible={subtitlesVisible}
                isPeekingSubs={isPeekingSubs}
                onPlayPause={onPlayPause}
                onPrevSubtitle={onPrevSubtitle}
                onNextSubtitle={onNextSubtitle}
                onToggleSubtitles={() => setSubtitlesVisible(!subtitlesVisible)}
                onChangePlaybackRate={onChangePlaybackRate}
              />
            </div>

            {/* Right Panel: Review Points */}
            {isReviewCollapsed ? (
              <div className="w-14 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col items-center py-4 gap-4 shadow-xl">
                <button
                  onClick={() => setIsReviewCollapsed(false)}
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Expand Review Points"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex flex-col items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                  <List size={16} className="text-gray-400" />
                  <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800/50">
                    {subtitles.length}
                  </span>
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700/50">
                    {markers.length}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col shadow-xl transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsReviewCollapsed(true)}
                      className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Collapse Review Points"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <h2 className="font-bold text-xl text-gray-900 dark:text-white">Review Points</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {feedbackStatus === 'saved' && (
                      <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
                    )}
                    {feedbackStatus === 'error' && (
                      <span className="text-xs text-red-500">Failed</span>
                    )}
                    <button
                      onClick={handleGenerateFeedback}
                      disabled={!canGenerateFeedback || feedbackStatus === 'saving'}
                      className="px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {feedbackStatus === 'saving' ? 'Saving...' : 'Generate Feedback'}
                    </button>
                    <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-[10px] px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800/50" title="Total subtitles loaded">
                      {subtitles.length} SUBS
                    </span>
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700/50">
                      {markers.length} MARKS
                    </span>
                  </div>
                </div>

                <div
                  ref={currentLineRef}
                  className="mb-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Current Line
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {activeSegment ? `${activeSegment.start.toFixed(2)}s – ${activeSegment.end.toFixed(2)}s` : 'No subtitle selected'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrevLine}
                        className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Prev
                      </button>
                      <button
                        onClick={handleNextLine}
                        className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    {activeSegment ? (
                      <VocabularyBreakdown
                        text={activeSegment.text}
                        markedIndices={currentLineMarker?.misunderstoodIndices || []}
                        onToggleWord={(idx) => onToggleSegmentWord(activeSegment, idx)}
                        onToggleRange={(start, end) => onToggleSegmentRange(activeSegment, start, end)}
                        compact
                      />
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Pick a subtitle to start marking.</p>
                    )}
                  </div>

                  <div className="mt-3 space-y-3">
                    <button
                      onClick={handlePlayNative}
                      disabled={!activeSegment}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={16} />
                      Play Native
                    </button>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        Shadowing
                        <button
                          onClick={() => {
                            if (isShadowingEnabled && isRecording) stopRecording();
                            setIsShadowingEnabled(prev => !prev);
                          }}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isShadowingEnabled ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                          aria-pressed={isShadowingEnabled}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isShadowingEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>
                      {isShadowingEnabled && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {isRecording ? 'Recording' : 'Ready'}
                        </span>
                      )}
                    </div>

                    {isShadowingEnabled && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleRecord}
                          disabled={!activeSegment || isRecording}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${isRecording
                              ? 'bg-red-400/40 text-red-100 cursor-not-allowed'
                              : 'bg-red-500 text-white hover:bg-red-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <Mic size={16} />
                          {isRecording ? 'Recording...' : 'Record Shadow'}
                        </button>
                        <button
                          onClick={isRecording ? stopRecording : resetRecording}
                          disabled={!activeSegment || (!isRecording && !recordingBlob)}
                          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-sm"
                        >
                          {isRecording ? <Square size={14} /> : <RefreshCw size={14} />}
                          {isRecording ? 'Stop' : 'Reset'}
                        </button>
                      </div>
                    )}

                    {isShadowingEnabled && recordingUrl && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Your recording</p>
                        <audio controls src={recordingUrl} className="w-full" />
                      </div>
                    )}

                    {isShadowingEnabled && recorderError && (
                      <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                        {recorderError}
                      </p>
                    )}
                  </div>
                </div>

                <MarkerList
                  markers={markers}
                  currentLoopId={currentLoopId}
                  onPlayLoop={onPlayLoop}
                  onStopLoop={onStopLoop}
                  onDelete={onDeleteMarker}
                  onAddTag={onAddTag}
                  onRemoveTag={onRemoveTag}
                  onToggleWord={onToggleWord}
                  onToggleRange={onToggleRange}
                  onPlayOnce={onPlayOnce}
                  onFocusSegment={onFocusSegment}
                  onShadowSegment={handleShadowFromMarker}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
