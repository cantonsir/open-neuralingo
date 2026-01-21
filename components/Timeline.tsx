import React from 'react';
import { Marker } from '../types';

interface TimelineProps {
  duration: number;
  currentTime: number;
  markers: Marker[];
  onSeek: (time: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ duration, currentTime, markers, onSeek }) => {
  if (duration === 0) return null;

  return (
    <div
      className="relative h-12 w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 mt-4 rounded-md cursor-pointer group transition-colors shadow-inner"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        onSeek(percent * duration);
      }}
    >
      {/* Progress Bar */}
      <div
        className="absolute top-0 left-0 h-full bg-gray-200 dark:bg-gray-800 transition-all duration-200"
        style={{ width: `${(currentTime / duration) * 100}%` }}
      />

      {/* Current Time Indicator Line */}
      <div
        className="absolute top-0 h-full w-0.5 bg-red-500 z-10 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
        style={{ left: `${(currentTime / duration) * 100}%` }}
      />

      {/* Markers */}
      {markers.map((marker) => {
        const startPct = (marker.start / duration) * 100;
        const widthPct = ((marker.end - marker.start) / duration) * 100;

        return (
          <div
            key={marker.id}
            className="absolute top-2 bottom-2 bg-yellow-500/40 border-l border-r border-yellow-500 hover:bg-yellow-500/60 transition-colors rounded-sm"
            style={{
              left: `${startPct}%`,
              width: `${Math.max(widthPct, 0.5)}%`
            }}
            title={marker.subtitleText || "Marker"}
          />
        );
      })}
    </div>
  );
};

export default Timeline;
