import React from 'react';
import { YouTubePlayer } from 'react-youtube';
import VideoPlayer from './VideoPlayer';
import Timeline from './Timeline';
import MarkerList from './MarkerList';
import VideoControls from './VideoControls';
import VideoUrlInput from './VideoUrlInput';
import { Marker, Subtitle, PlayerState, TagType } from '../../types';

interface LoopViewProps {
  // Video state
  videoId: string;
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
}

export default function LoopView({
  videoId,
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
}: LoopViewProps) {
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
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
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
            <div className="w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col shadow-xl transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-xl text-gray-900 dark:text-white">Review Points</h2>
                <div className="flex gap-2">
                  <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-[10px] px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800/50" title="Total subtitles loaded">
                    {subtitles.length} SUBS
                  </span>
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700/50">
                    {markers.length} MARKS
                  </span>
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
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
