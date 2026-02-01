import React, { useEffect, useMemo, useState } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { ChevronLeft, ChevronRight, List, Mic, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import Timeline from './Timeline';
import MarkerList from './MarkerList';
import VideoControls from './VideoControls';
import VideoUrlInput from './VideoUrlInput';
import CurrentLinePanel from './CurrentLinePanel';
import { FocusedSegment, Marker, Subtitle, PlayerState, TagType, PracticeMode } from '../../types';
import { checkSubtitleConfig, SubtitleConfigStatus, getConfigStatusMessage } from '../../services/subtitleGenerationService';

interface LoopViewProps {
  // Video state
  videoId: string;
  audioUrl?: string; // Add audioUrl prop
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
  onToggleSegmentWord: (segment: FocusedSegment | null, index: number) => void;
  onToggleSegmentRange: (segment: FocusedSegment | null, start: number, end: number) => void;
  
  // Subtitle generation
  onGenerateSubtitles?: (videoId: string) => Promise<void>;
  isGeneratingSubtitles?: boolean;
}

export default function LoopView({
  videoId,
  audioUrl,
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
  onToggleSegmentWord,
  onToggleSegmentRange,
  onGenerateSubtitles,
  isGeneratingSubtitles = false,
}: LoopViewProps) {
  const [isReviewCollapsed, setIsReviewCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('listeningReviewCollapsed') === 'true';
  });
  const [practiceMode, setPracticeMode] = React.useState<PracticeMode>(() => {
    if (typeof window === 'undefined') return 'loop';
    return (window.localStorage.getItem('listeningPracticeMode') as PracticeMode) || 'loop';
  });
  
  // Subtitle generation config status
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfigStatus | null>(null);
  const [configChecked, setConfigChecked] = useState(false);
  
  // Check subtitle generation config when video loads without subtitles
  useEffect(() => {
    if (videoId && !audioUrl && subtitles.length === 0 && !configChecked) {
      checkSubtitleConfig().then(config => {
        setSubtitleConfig(config);
        setConfigChecked(true);
        console.log('[LoopView] Subtitle config:', config);
      });
    }
  }, [videoId, audioUrl, subtitles.length, configChecked]);

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
    window.localStorage.setItem('listeningPracticeMode', practiceMode);
  }, [practiceMode]);

  const handlePlayNative = () => {
    if (!activeSegment) return;
    onPlayOnce(activeSegment.start, activeSegment.end);
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
        {!videoId && !audioUrl ? (
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
                  audioUrl={audioUrl}
                  onReady={onPlayerReady}
                  onStateChange={onStateChange}
                  currentSubtitle={currentSubtitle}
                  playbackRate={state.playbackRate}
                  forceShowSubtitle={subtitlesVisible || isPeekingSubs}
                  title={audioUrl ? videoTitle : undefined}
                  showTitle={!!audioUrl && !subtitlesVisible}
                />

                {/* No Subtitles Banner - Show when video loaded but no subtitles */}
                {videoId && !audioUrl && subtitles.length === 0 && (
                  <div className="mt-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <Mic className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">No Subtitles Available</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Generate subtitles using AI speech recognition
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onGenerateSubtitles?.(videoId)}
                        disabled={isGeneratingSubtitles || !onGenerateSubtitles || (subtitleConfig?.overallStatus === 'not_ready')}
                        className={`
                          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                          ${isGeneratingSubtitles || subtitleConfig?.overallStatus === 'not_ready'
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                          }
                        `}
                      >
                        {isGeneratingSubtitles ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-4 h-4" />
                            <span>Generate Subtitles</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Config Status */}
                    {subtitleConfig && (
                      <div className="mt-3 pt-3 border-t border-amber-500/20">
                        <div className="flex items-center gap-2 text-sm">
                          {subtitleConfig.overallStatus === 'ready' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-600 dark:text-green-400">
                                Ready ({subtitleConfig.readyServices.join(' + ')})
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                              <span className="text-amber-600 dark:text-amber-400">
                                {getConfigStatusMessage(subtitleConfig)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {isGeneratingSubtitles && (
                      <div className="mt-3 pt-3 border-t border-amber-500/20">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                          <span>Processing audio with speech-to-text... This may take 30-60 seconds.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                {/* Panel Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsReviewCollapsed(true)}
                      className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Collapse Panel"
                    >
                      <ChevronRight size={16} />
                    </button>
                    {/* Tab Buttons */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                      <button
                        onClick={() => setPracticeMode('loop')}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${
                          practiceMode === 'loop'
                            ? 'bg-yellow-500 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        Loop
                      </button>
                      <button
                        onClick={() => setPracticeMode('shadow')}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${
                          practiceMode === 'shadow'
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        Shadow
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700/50">
                      {markers.length}
                    </span>
                  </div>
                </div>

                {/* Conditional Content Based on Mode */}
                {practiceMode === 'loop' ? (
                  /* Loop Mode: Marker List */
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
                  />
                ) : (
                  /* Shadow Mode: Current Line Panel */
                  <CurrentLinePanel
                    activeSegment={activeSegment}
                    currentLineMarker={currentLineMarker}
                    subtitlesVisible={subtitlesVisible}
                    onToggleWord={onToggleSegmentWord}
                    onToggleRange={onToggleSegmentRange}
                    onPlayNative={handlePlayNative}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
