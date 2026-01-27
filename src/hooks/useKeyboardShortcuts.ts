import { useEffect } from 'react';
import { YouTubePlayer } from 'react-youtube';

interface UseKeyboardShortcutsOptions {
  isSetupMode: boolean;
  player: YouTubePlayer | null;
  isPlaying: boolean;
  addMarker: () => void;
  handlePrevSubtitle: () => void;
  handleNextSubtitle: () => void;
  setIsPeekingSubs: (value: boolean) => void;
}

export function useKeyboardShortcuts({
  isSetupMode,
  player,
  isPlaying,
  addMarker,
  handlePrevSubtitle,
  handleNextSubtitle,
  setIsPeekingSubs,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSetupMode) return;

      // Ignore global shortcuts if user is typing in an input field
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      // Space bar: Create marker
      if (e.code === 'Space') {
        e.preventDefault();
        addMarker();
      }

      // S key: Peek subtitle
      if (e.code === 'KeyS' && !e.repeat) {
        setIsPeekingSubs(true);
      }

      // K / P: Toggle Play/Pause
      if (e.key === 'k' || e.key === 'K' || e.key === 'p') {
        if (isPlaying) player?.pauseVideo();
        else player?.playVideo();
      }

      // Arrows for Sentence Navigation
      if (e.key === 'ArrowLeft') {
        handlePrevSubtitle();
      }
      if (e.key === 'ArrowRight') {
        handleNextSubtitle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyS') {
        setIsPeekingSubs(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [addMarker, isSetupMode, player, isPlaying, handlePrevSubtitle, handleNextSubtitle, setIsPeekingSubs]);
}
