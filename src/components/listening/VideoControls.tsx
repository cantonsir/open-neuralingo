import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronDown, Mic, Loader2, Check, Gauge } from 'lucide-react';
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
  // Subtitle generation
  onGenerateSubtitles?: () => void;
  isGeneratingSubtitles?: boolean;
  showGenerateButton?: boolean;
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
  onGenerateSubtitles,
  isGeneratingSubtitles = false,
  showGenerateButton = false,
}: VideoControlsProps) {
  const [isSubsMenuOpen, setIsSubsMenuOpen] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const subsMenuRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subsMenuRef.current && !subsMenuRef.current.contains(event.target as Node)) {
        setIsSubsMenuOpen(false);
      }
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setIsSpeedMenuOpen(false);
      }
    };

    if (isSubsMenuOpen || isSpeedMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSubsMenuOpen, isSpeedMenuOpen]);

  // Close menus on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSubsMenuOpen(false);
        setIsSpeedMenuOpen(false);
      }
    };

    if (isSubsMenuOpen || isSpeedMenuOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSubsMenuOpen, isSpeedMenuOpen]);

  const handleToggleSubtitles = () => {
    onToggleSubtitles();
    // Keep menu open so user can see the state change
  };

  const handleGenerateSubtitles = () => {
    onGenerateSubtitles?.();
    setIsSubsMenuOpen(false); // Close menu when generating starts
  };

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

        {/* Subtitle Dropdown Menu */}
        <div className="relative ml-4" ref={subsMenuRef}>
          <button
            onClick={() => setIsSubsMenuOpen(!isSubsMenuOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subtitlesVisible || isPeekingSubs 
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/50' 
                : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent'
            }`}
            title="Subtitle options"
          >
            {subtitlesVisible || isPeekingSubs ? <Eye size={16} /> : <EyeOff size={16} />}
            <span>SUBS</span>
            <ChevronDown size={14} className={`transition-transform ${isSubsMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu - Opens upward since control bar is at bottom */}
          {isSubsMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Show Subtitles Toggle */}
              <button
                onClick={handleToggleSubtitles}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {subtitlesVisible ? <Eye size={18} className="text-blue-500" /> : <EyeOff size={18} className="text-gray-400" />}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Show Subtitles
                  </span>
                </div>
                {subtitlesVisible && (
                  <Check size={16} className="text-blue-500" />
                )}
              </button>

              {/* Separator */}
              {showGenerateButton && (
                <>
                  <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

                  {/* Generate Subtitles Option */}
                  <button
                    onClick={handleGenerateSubtitles}
                    disabled={isGeneratingSubtitles}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                      isGeneratingSubtitles
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {isGeneratingSubtitles ? (
                      <Loader2 size={18} className="animate-spin text-amber-500" />
                    ) : (
                      <Mic size={18} className="text-amber-500" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {isGeneratingSubtitles ? 'Generating...' : 'Generate Subtitles'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {isGeneratingSubtitles ? 'This may take 30-60s' : 'AI speech recognition'}
                      </span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Speed Dropdown Menu */}
      <div className="relative" ref={speedMenuRef}>
        <button
          onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            playbackRate !== 1
              ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/50'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent'
          }`}
          title="Playback speed"
        >
          <Gauge size={16} />
          <span>{playbackRate}x</span>
          <ChevronDown size={14} className={`transition-transform ${isSpeedMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Speed Dropdown Menu - Opens upward */}
        {isSpeedMenuOpen && (
          <div className="absolute bottom-full right-0 mb-2 w-36 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {speedOptions.map(rate => (
              <button
                key={rate}
                onClick={() => {
                  onChangePlaybackRate(rate);
                  setIsSpeedMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left ${
                  playbackRate === rate ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                <span className="text-sm font-medium">{rate}x</span>
                {playbackRate === rate && (
                  <Check size={16} className="text-yellow-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
