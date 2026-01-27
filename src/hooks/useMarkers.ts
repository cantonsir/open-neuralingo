import { useState, useCallback } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { Marker, Subtitle, TagType } from '../types';

interface UseMarkersOptions {
  player: YouTubePlayer | null;
  videoId: string;
  subtitles: Subtitle[];
}

export function useMarkers({ player, videoId, subtitles }: UseMarkersOptions) {
  const [markers, setMarkers] = useState<Marker[]>([]);

  const addMarker = useCallback(async () => {
    if (!player) return;

    const t = await player.getCurrentTime();
    const now = Date.now();

    setMarkers(prevMarkers => {
      // 1. Find EXACT current subtitle
      let sub = subtitles.find(s => t >= s.start && t <= s.end);

      // 2. Strict Fallback: If no exact match, find the CLOSEST one within 1s
      if (!sub && subtitles.length > 0) {
        const closest = subtitles.reduce((prev, curr) => {
          const prevDist = Math.min(Math.abs(t - prev.start), Math.abs(t - prev.end));
          const currDist = Math.min(Math.abs(t - curr.start), Math.abs(t - curr.end));
          return currDist < prevDist ? curr : prev;
        });
        if (Math.min(Math.abs(t - closest.start), Math.abs(t - closest.end)) < 1.0) {
          sub = closest;
        }
      }

      let start, end, subtitleText;

      if (sub) {
        start = sub.start;
        end = sub.end;
        subtitleText = sub.text;

        // IDEMPOTENCY check: increment pressCount if same subtitle
        const lastMarker = prevMarkers[prevMarkers.length - 1];
        if (lastMarker && Math.abs(lastMarker.start - start) < 0.1 && Math.abs(lastMarker.end - end) < 0.1) {
          const updatedMarker = {
            ...lastMarker,
            pressCount: (lastMarker.pressCount || 1) + 1
          };
          return [...prevMarkers.slice(0, -1), updatedMarker];
        }
      } else {
        start = Math.max(0, t - 2);
        end = t + 2;
        subtitleText = undefined;
      }

      const newMarker: Marker = {
        id: Math.random().toString(36).substr(2, 9),
        videoId: videoId,
        start,
        end,
        createdAt: now,
        subtitleText,
        tags: []
      };

      return [...prevMarkers, newMarker];
    });
  }, [player, subtitles, videoId]);

  const handleDeleteMarker = (id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  const handleAddTag = (id: string, tag: TagType) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id && !m.tags.includes(tag)) {
        return { ...m, tags: [...m.tags, tag] };
      }
      return m;
    }));
  };

  const handleRemoveTag = (id: string, tagToRemove: TagType) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, tags: m.tags.filter(t => t !== tagToRemove) };
      }
      return m;
    }));
  };

  const handleToggleWord = (id: string, wordIndex: number) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id) {
        const indices = new Set(m.misunderstoodIndices || []);
        if (indices.has(wordIndex)) indices.delete(wordIndex);
        else indices.add(wordIndex);
        return { ...m, misunderstoodIndices: Array.from(indices) };
      }
      return m;
    }));
  };

  const handleToggleRange = (id: string, start: number, end: number) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id) {
        const currentIndices = new Set(m.misunderstoodIndices || []);
        const range = [];
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          range.push(i);
        }

        const allSelected = range.every(idx => currentIndices.has(idx));

        if (allSelected) {
          range.forEach(idx => currentIndices.delete(idx));
        } else {
          range.forEach(idx => currentIndices.add(idx));
        }

        return { ...m, misunderstoodIndices: Array.from(currentIndices) };
      }
      return m;
    }));
  };

  const handleRemoveWord = (wordToRemove: string) => {
    setMarkers(prev => prev.map(m => {
      if (!m.subtitleText || !m.misunderstoodIndices?.length) return m;

      const words = m.subtitleText.trim().split(/\s+/).filter(w => w.length > 0);
      const newIndices = m.misunderstoodIndices.filter(index => {
        const w = words[index];
        return w !== wordToRemove;
      });

      if (newIndices.length !== m.misunderstoodIndices.length) {
        return { ...m, misunderstoodIndices: newIndices };
      }
      return m;
    }));
  };

  const handleUpdateVocabData = (markerId: string, index: number, field: 'definition' | 'notes', value: string) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === markerId) {
        const currentVocab = m.vocabData || {};
        const currentItem = currentVocab[index] || { definition: '', notes: '' };

        return {
          ...m,
          vocabData: {
            ...currentVocab,
            [index]: { ...currentItem, [field]: value }
          }
        };
      }
      return m;
    }));
  };

  return {
    markers,
    setMarkers,
    addMarker,
    handleDeleteMarker,
    handleAddTag,
    handleRemoveTag,
    handleToggleWord,
    handleToggleRange,
    handleRemoveWord,
    handleUpdateVocabData,
  };
}
