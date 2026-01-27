import React from 'react';

interface VideoUrlInputProps {
  inputUrl: string;
  setInputUrl: (url: string) => void;
  isFetchingSubs: boolean;
  onLoadVideo: () => void;
}

export default function VideoUrlInput({
  inputUrl,
  setInputUrl,
  isFetchingSubs,
  onLoadVideo,
}: VideoUrlInputProps) {
  return (
    <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
      <div className="flex items-center gap-3 max-w-3xl">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
            placeholder="Paste YouTube URL here..."
          />
        </div>
        <button
          onClick={onLoadVideo}
          disabled={isFetchingSubs || !inputUrl.trim()}
          className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold py-2.5 px-5 rounded-lg transition-all shadow-md shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
        >
          {isFetchingSubs ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Load Video
            </>
          )}
        </button>
      </div>
    </div>
  );
}
