import React from 'react';
import { Play, Pause, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime } from '../../utils';

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  subtitlesVisible: boolean;
  isPeekingSubs: boolean;
  onPlayPause: () => void;
  onPrevSubtitle: () => void;
  onNextSubtitle: () => void;
  onToggleSubtitles: () => void;
  onChangePlaybackRate: (rate: number) => void;
}

export default function VideoControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  subtitlesVisible,
  isPeekingSubs,
  onPlayPause,
  onPrevSubtitle,
  onNextSubtitle,
  onToggleSubtitles,
  onChangePlaybackRate,
}: VideoControlsProps) {
  return (
    <div className="h-20 flex items-center justify-between mt-4 bg-white/80 dark:bg-gray-900/50 rounded-xl px-6 border border-gray-200 dark:border-gray-800 transition-colors">
      <div className="flex items-center gap-4">
        <button
          onClick={onPlayPause}
          className="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg shadow-yellow-500/25"
        >
          {isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-0.5" />}
        </button>

        <div className="flex items-center gap-1 mx-2">
          <button
            onClick={onPrevSubtitle}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Previous Sentence"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={onNextSubtitle}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Next Sentence"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Subtitle Toggle */}
        <button
          onClick={onToggleSubtitles}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-4 ${
            subtitlesVisible || isPeekingSubs 
              ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/50' 
              : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent'
          }`}
          title="Toggle Subtitles (or press 'S' to peek)"
        >
          {subtitlesVisible || isPeekingSubs ? <Eye size={16} /> : <EyeOff size={16} />}
          <span>{subtitlesVisible ? 'SUBS ON' : 'SUBS OFF'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase mr-2">Speed</span>
        {[0.75, 1, 1.25].map(rate => (
          <button
            key={rate}
            onClick={() => onChangePlaybackRate(rate)}
            className={`
              px-3 py-1 text-sm rounded-md font-medium transition-colors
              ${playbackRate === rate 
                ? 'bg-yellow-500 text-black' 
                : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:text-white'}
            `}
          >
            {rate}x
          </button>
        ))}
      </div>
    </div>
  );
}
