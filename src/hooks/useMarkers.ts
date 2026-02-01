import { useState, useCallback, useEffect } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { FocusedSegment, Marker, Subtitle, TagType } from '../types';

interface UseMarkersOptions {
  player: YouTubePlayer | null;
  videoId: string;
  subtitles: Subtitle[];
}

export function useMarkers({ player, videoId, subtitles }: UseMarkersOptions) {
  const [markers, setMarkers] = useState<Marker[]>([]);

  // Clear markers when videoId changes (new video loaded)
  useEffect(() => {
    setMarkers([]);
  }, [videoId]);

  const findMarkerForSegment = (segment: FocusedSegment, list: Marker[]) => {
    if (segment.subtitleId) {
      const direct = list.find(m => m.id === segment.subtitleId);
      if (direct) return direct;
    }

    return list.find(m => Math.abs(m.start - segment.start) < 0.1 && Math.abs(m.end - segment.end) < 0.1);
  };

  const addMarker = useCallback(async (source: 'loop' | 'shadow' = 'loop') => {
    if (!player) {
      console.warn('[addMarker] No player available');
      return;
    }

    // Validate subtitles availability
    if (subtitles.length === 0) {
      console.warn('[addMarker] ⚠️ No subtitles available. Using time-based fallback.');
    }

    const t = await player.getCurrentTime();
    const now = Date.now();

    // Add detailed logging
    console.log('[addMarker] Creating marker at time:', t.toFixed(2), 's with', subtitles.length, 'subtitles');

    setMarkers(prevMarkers => {
      // 1. Find EXACT current subtitle
      let sub = subtitles.find(s => t >= s.start && t <= s.end);

      // Log subtitle matching result
      if (sub) {
        console.log('[addMarker] ✅ Found subtitle:', sub.text.substring(0, 50));
      } else {
        console.log('[addMarker] ⚠️ No exact match, trying closest...');
      }

      // 2. Strict Fallback: If no exact match, find the CLOSEST one within 1s
      if (!sub && subtitles.length > 0) {
        const closest = subtitles.reduce((prev, curr) => {
          const prevDist = Math.min(Math.abs(t - prev.start), Math.abs(t - prev.end));
          const currDist = Math.min(Math.abs(t - curr.start), Math.abs(t - curr.end));
          return currDist < prevDist ? curr : prev;
        });
        if (Math.min(Math.abs(t - closest.start), Math.abs(t - closest.end)) < 1.0) {
          sub = closest;
          console.log('[addMarker] ✅ Found closest subtitle:', sub.text.substring(0, 50));
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
          console.log('[addMarker] 🔄 Incrementing press count for existing marker');
          const updatedMarker = {
            ...lastMarker,
            pressCount: (lastMarker.pressCount || 1) + 1
          };
          return [...prevMarkers.slice(0, -1), updatedMarker];
        }
      } else {
        console.log('[addMarker] ⚠️ Using time-based fallback (±2s)');
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
        tags: source === 'shadow' ? ['shadow'] : [],
        source,
      };

      console.log('[addMarker] ✅ Created marker:', newMarker.id, 'with text:', subtitleText?.substring(0, 30) || 'time-based');
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

  const handleToggleWordForSegment = (
    segment: FocusedSegment | null,
    wordIndex: number,
    source: 'loop' | 'shadow' = 'loop'
  ) => {
    if (!segment || !segment.text.trim()) return;

    setMarkers(prev => {
      const existing = findMarkerForSegment(segment, prev);
      if (existing) {
        return prev.map(m => {
          if (m.id !== existing.id) return m;
          const indices = new Set(m.misunderstoodIndices || []);
          if (indices.has(wordIndex)) indices.delete(wordIndex);
          else indices.add(wordIndex);
          return {
            ...m,
            subtitleText: m.subtitleText || segment.text,
            misunderstoodIndices: Array.from(indices),
          };
        });
      }

      const newMarker: Marker = {
        id: Math.random().toString(36).substr(2, 9),
        videoId: videoId,
        start: segment.start,
        end: segment.end,
        createdAt: Date.now(),
        subtitleText: segment.text,
        tags: source === 'shadow' ? ['shadow'] : [],
        misunderstoodIndices: [wordIndex],
        source,
      };

      return [...prev, newMarker];
    });
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

  const handleToggleRangeForSegment = (
    segment: FocusedSegment | null,
    start: number,
    end: number,
    source: 'loop' | 'shadow' = 'loop'
  ) => {
    if (!segment || !segment.text.trim()) return;

    setMarkers(prev => {
      const range = [];
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        range.push(i);
      }

      const existing = findMarkerForSegment(segment, prev);
      if (existing) {
        return prev.map(m => {
          if (m.id !== existing.id) return m;
          const currentIndices = new Set(m.misunderstoodIndices || []);
          const allSelected = range.every(idx => currentIndices.has(idx));

          if (allSelected) {
            range.forEach(idx => currentIndices.delete(idx));
          } else {
            range.forEach(idx => currentIndices.add(idx));
          }

          return {
            ...m,
            subtitleText: m.subtitleText || segment.text,
            misunderstoodIndices: Array.from(currentIndices),
          };
        });
      }

      const newMarker: Marker = {
        id: Math.random().toString(36).substr(2, 9),
        videoId: videoId,
        start: segment.start,
        end: segment.end,
        createdAt: Date.now(),
        subtitleText: segment.text,
        tags: source === 'shadow' ? ['shadow'] : [],
        misunderstoodIndices: range,
        source,
      };

      return [...prev, newMarker];
    });
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
    handleToggleWordForSegment,
    handleToggleRange,
    handleToggleRangeForSegment,
    handleRemoveWord,
    handleUpdateVocabData,
  };
}
