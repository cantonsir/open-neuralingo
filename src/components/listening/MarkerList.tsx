import React from 'react';
import { FocusedSegment, Marker, TagType } from '../../types';
import { Play, Repeat, Trash2, Tag as TagIcon, Mic } from 'lucide-react';
import { formatTime } from '../../utils';
import VocabularyBreakdown from './VocabularyBreakdown';

interface MarkerListProps {
  markers: Marker[];
  currentLoopId: string | null;
  onPlayLoop: (marker: Marker) => void;
  onStopLoop: () => void;
  onDelete: (id: string) => void;
  onAddTag: (id: string, tag: TagType) => void;
  onRemoveTag: (id: string, tag: TagType) => void;
  onToggleWord: (id: string, index: number) => void;
  onToggleRange: (id: string, start: number, end: number) => void;
  onPlayOnce: (start: number, end: number) => void;
  onFocusSegment: (segment: FocusedSegment | null) => void;
  onShadowSegment: (segment: FocusedSegment) => void;
}

const TAG_CONFIG: Record<TagType, { label: string; color: string }> = {
  'too-fast': { label: 'Too Fast', color: 'bg-red-900 text-red-200 border-red-700' },
  'unclear': { label: 'Unclear', color: 'bg-orange-900 text-orange-200 border-orange-700' },
  'accent': { label: 'Accent', color: 'bg-purple-900 text-purple-200 border-purple-700' },
  'grammar': { label: 'Grammar', color: 'bg-blue-900 text-blue-200 border-blue-700' },
  'vocabulary': { label: 'Vocab', color: 'bg-green-900 text-green-200 border-green-700' },
};

const MarkerList: React.FC<MarkerListProps> = ({
  markers,
  currentLoopId,
  onPlayLoop,
  onStopLoop,
  onDelete,
  onAddTag,
  onRemoveTag,
  onToggleWord,
  onToggleRange,
  onPlayOnce,
  onFocusSegment,
  onShadowSegment,
}) => {
  const [revealedIds, setRevealedIds] = React.useState<Set<string>>(new Set());
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const prevLengthRef = React.useRef(markers.length);

  // Auto-scroll to bottom ONLY when a new marker is added
  React.useEffect(() => {
    if (markers.length > prevLengthRef.current) {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevLengthRef.current = markers.length;
  }, [markers.length]);

  const toggleReveal = (id: string, e: React.MouseEvent) => {
    // ... same toggleReveal logic ...
    e.stopPropagation();
    const newRevealed = new Set(revealedIds);
    if (newRevealed.has(id)) newRevealed.delete(id);
    else newRevealed.add(id);
    setRevealedIds(newRevealed);
  };

  const buildFocusedSegment = (marker: Marker): FocusedSegment | null => {
    if (!marker.subtitleText || !marker.subtitleText.trim()) return null;
    return {
      start: marker.start,
      end: marker.end,
      text: marker.subtitleText,
      subtitleId: marker.id,
    };
  };

  if (markers.length === 0) {
    // ... same empty check ...
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl mt-4">
        <p className="text-lg font-medium">No confusion points yet</p>
        <p className="text-sm mt-2">Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-300 font-mono text-xs font-bold shadow-sm">Space</kbd> while listening</p>
      </div>
    );
  }

  // OLD: const sortedMarkers = [...markers].sort((a, b) => b.createdAt - a.createdAt);
  // NEW: Sort from oldest to newest (ascending)
  const sortedMarkers = [...markers].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-3 mt-4 overflow-y-auto h-full pb-24 scroll-smooth"
    >
      {sortedMarkers.map((marker) => {
        const isLooping = currentLoopId === marker.id;
        const isRevealed = revealedIds.has(marker.id);
        const hasSubtitle = !!marker.subtitleText;
        const focusSegment = buildFocusedSegment(marker);
        const canShadow = !!focusSegment;

        return (
          <div
            key={marker.id}
            className={`
              relative p-4 rounded-xl border transition-all duration-200 group
              ${isLooping
                ? 'bg-yellow-50 dark:bg-gray-800 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)] transform scale-[1.01]'
                : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 shadow-sm'}
            `}
          >
            {/* Header: Time & Controls */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-yellow-500 font-bold text-sm bg-yellow-500/10 px-2 py-0.5 rounded">
                  {formatTime(marker.start)} - {formatTime(marker.end)}
                </span>

                {/* Press Count Badge (Difficulty) */}
                {marker.pressCount && marker.pressCount > 1 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded" title="Number of times Space was pressed">
                    x{marker.pressCount}
                  </span>
                )}

                {isLooping && (
                  <span className="flex items-center gap-1 text-xs text-green-400 animate-pulse">
                    <Repeat size={12} /> Looping
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onDelete(marker.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Subtitle Text (Flashcard Mode OR Vocabulary Breakdown) */}
            <div
              onClick={(e) => hasSubtitle && !isRevealed && toggleReveal(marker.id, e)}
              className={`
                 mb-3 p-3 rounded-lg text-sm leading-relaxed transition-colors relative overflow-hidden
                 ${hasSubtitle
                  ? (isRevealed ? 'bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-gray-200 cursor-default' : 'bg-gray-100/50 dark:bg-gray-800/20 hover:bg-gray-100 dark:hover:bg-gray-800/40 text-transparent select-none cursor-pointer')
                  : 'text-gray-400 dark:text-gray-500 italic cursor-default'
                }
               `}
            >
              {hasSubtitle ? (
                <>
                  {isRevealed ? (
                    <VocabularyBreakdown
                      text={marker.subtitleText!}
                      markedIndices={marker.misunderstoodIndices || []}
                      onToggleWord={(idx) => onToggleWord(marker.id, idx)}
                      onToggleRange={(start, end) => onToggleRange(marker.id, start, end)}
                    />
                  ) : (
                    <>
                      <span className="blur-md select-none text-gray-900 dark:text-gray-100">
                        {marker.subtitleText}
                      </span>
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 font-medium text-xs uppercase tracking-wider">
                        Click to Reveal
                      </div>
                    </>
                  )}
                </>
              ) : (
                "No subtitle text available"
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {marker.tags.map(tag => (
                <span key={tag} className={`flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${TAG_CONFIG[tag].color}`}>
                  {TAG_CONFIG[tag].label}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTag(marker.id, tag);
                    }}
                    className="hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}

              <div className="relative group/tags opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-2 py-0.5 rounded hover:bg-gray-800">
                  <TagIcon size={10} /> + Tag
                </button>
                {/* Popover for tags */}
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover/tags:flex flex-col bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-50 min-w-[120px]">
                  {(Object.keys(TAG_CONFIG) as TagType[]).map((tagKey) => (
                    <button
                      key={tagKey}
                      onClick={() => onAddTag(marker.id, tagKey)}
                      className="text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 rounded hover:text-white"
                    >
                      {TAG_CONFIG[tagKey].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Play/Loop Controls */}
            <div className="flex gap-2">
              {/* Main Action: Play Once */}
              <button
                onClick={() => {
                  onFocusSegment(focusSegment);
                  onPlayOnce(marker.start, marker.end);
                }}
                className="flex-1 py-2 flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition-all bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm"
              >
                <Play size={14} fill="currentColor" /> Replay
              </button>

              {/* Secondary Action: Loop */}
              <button
                onClick={() => {
                  onFocusSegment(focusSegment);
                  if (isLooping) onStopLoop();
                  else onPlayLoop(marker);
                }}
                className={`
                  px-3 flex items-center justify-center rounded-lg transition-all border shadow-sm
                  ${isLooping
                    ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-200 dark:border-yellow-500/50'
                    : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-yellow-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
                title={isLooping ? "Stop Looping" : "Loop Segment"}
              >
                <Repeat size={16} className={isLooping ? "animate-spin-slow" : ""} />
              </button>

              {/* Shadow Action */}
              <button
                onClick={() => {
                  if (!focusSegment) return;
                  onShadowSegment(focusSegment);
                }}
                disabled={!canShadow}
                className={`
                  px-3 flex items-center justify-center rounded-lg transition-all border shadow-sm
                  ${canShadow
                    ? 'bg-white dark:bg-gray-800 text-gray-400 hover:text-orange-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    : 'bg-gray-100 dark:bg-gray-900 text-gray-300 border-gray-200 dark:border-gray-800 cursor-not-allowed'}
                `}
                title="Shadow this line"
              >
                <Mic size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MarkerList;
