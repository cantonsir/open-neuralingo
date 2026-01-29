/**
 * VideoContextExtractor Component
 *
 * A modal component for extracting context from YouTube URLs.
 * Validates URLs, fetches transcripts, and displays video metadata.
 */

import React, { useState } from 'react';
import { X, Link, Loader2, Video, AlertCircle, Check } from 'lucide-react';
import { api } from '../../db';

export interface VideoContext {
    url: string;
    videoId: string;
    title: string;
    thumbnail: string;
    transcript: string;
    duration?: number;
}

interface VideoContextExtractorProps {
    onExtract: (context: VideoContext) => void;
    onClose: () => void;
}

// YouTube URL validation and ID extraction
function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/  // Just the video ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}

const VideoContextExtractor: React.FC<VideoContextExtractorProps> = ({
    onExtract,
    onClose
}) => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<VideoContext | null>(null);

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
        setError(null);
        setPreview(null);
    };

    const handleExtract = async () => {
        const videoId = extractYouTubeId(url.trim());

        if (!videoId) {
            setError('Invalid YouTube URL. Please enter a valid YouTube video link.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Call backend API to extract video context
            const context = await api.extractVideoContext(url.trim());

            setPreview({
                url: url.trim(),
                videoId: context.videoId || videoId,
                title: context.title || 'YouTube Video',
                thumbnail: context.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                transcript: context.transcript || '',
                duration: context.duration
            });
        } catch (err) {
            console.error('Failed to extract video context:', err);

            // Fallback: Use basic info without transcript
            setPreview({
                url: url.trim(),
                videoId,
                title: 'YouTube Video',
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                transcript: '',
                duration: undefined
            });

            setError('Could not extract transcript. You can still use the video URL for context.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        if (preview) {
            onExtract(preview);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading && url.trim()) {
            handleExtract();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full shadow-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <Video size={20} className="text-red-500" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Add Video Context
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-4 space-y-4">
                    {/* URL Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            YouTube URL
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={url}
                                    onChange={handleUrlChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="https://youtube.com/watch?v=..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                onClick={handleExtract}
                                disabled={isLoading || !url.trim()}
                                className="px-4 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    'Extract'
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Video Preview */}
                    {preview && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                            {/* Thumbnail */}
                            <div className="relative aspect-video bg-gray-200 dark:bg-gray-700">
                                <img
                                    src={preview.thumbnail}
                                    alt={preview.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${preview.videoId}/default.jpg`;
                                    }}
                                />
                                {preview.transcript && (
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded">
                                        Transcript Available
                                    </div>
                                )}
                            </div>

                            {/* Video Info */}
                            <div className="p-3">
                                <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2">
                                    {preview.title}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    Video ID: {preview.videoId}
                                </p>
                                {preview.transcript && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                        {preview.transcript.split(' ').length} words extracted
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Help Text */}
                    {!preview && !error && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Paste a YouTube URL to extract the video transcript. The transcript will be used as context for generating more relevant practice dialogues.
                        </p>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!preview}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium rounded-lg hover:from-red-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        <Check size={16} />
                        Add Video
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoContextExtractor;
