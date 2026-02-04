import React, { useState, useEffect, useRef } from 'react';
import { Book, Upload, Trash2, FileText, Loader2, Link2, BookOpen } from 'lucide-react';
import { View } from '../../types';
import { formatTimeAgo } from '../../utils/formatters';

interface LibraryItem {
    id: string;
    title: string;
    filename: string;
    file_type: string;
    created_at: number;
}

interface ReadingLibraryProps {
    onNavigate: (view: View, data?: any) => void;
}

export default function ReadingLibrary({ onNavigate }: ReadingLibraryProps) {
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const urlPopoverRef = useRef<HTMLDivElement>(null);

    const extractYoutubeId = (value: string): string | null => {
        if (!value) return null;
        if (value.length === 11 && !value.includes('http')) return value;
        const match = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    };

    const getDisplayTitle = (item: LibraryItem) => {
        if (item.file_type === 'youtube' && item.title.toLowerCase().startsWith('youtube:')) {
            return item.title.slice(8).trim();
        }
        return item.title;
    };

    const getThumbnailUrl = (item: LibraryItem) => {
        if (item.file_type !== 'youtube') return null;
        const videoId = extractYoutubeId(item.filename || '') || extractYoutubeId(item.title || '');
        return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
    };

    const getTypeLabel = (fileType: string) => {
        if (!fileType) return 'Document';
        return fileType.toUpperCase();
    };

    const fetchLibrary = async () => {
        try {
            const res = await fetch('/api/library');
            if (res.ok) {
                const data = await res.json();
                setLibrary(data);
            }
        } catch (error) {
            console.error('Failed to fetch library:', error);
        }
    };

    useEffect(() => {
        const loadLibrary = async () => {
            setIsLoading(true);
            await fetchLibrary();
            setIsLoading(false);
        };

        loadLibrary();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!showUrlInput) return;
            const target = event.target as Node;
            if (urlPopoverRef.current && !urlPopoverRef.current.contains(target)) {
                setShowUrlInput(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUrlInput]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                await fetchLibrary();
            } else {
                alert('Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleUrlImport = async () => {
        if (!importUrl.trim()) return;

        setIsImporting(true);
        try {
            const res = await fetch('/api/library/import/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: importUrl.trim() })
            });

            if (res.ok) {
                const data = await res.json();
                setImportUrl('');
                setShowUrlInput(false);
                await fetchLibrary();
                alert(`Successfully imported: ${data.title || 'Content'}`);
            } else {
                const error = await res.json();
                alert(error.error || "Failed to import content");
            }
        } catch (e) {
            console.error(e);
            alert("Import failed. Please check the URL and try again.");
        } finally {
            setIsImporting(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            const res = await fetch(`/api/library/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setLibrary(prev => prev.filter(item => item.id !== id));
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Reading Library</h1>
                        <p className="text-gray-500 dark:text-gray-400">Manage your reading materials and generate lessons.</p>
                    </div>

                    <div className="flex gap-3">
                        <div className="relative" ref={urlPopoverRef}>
                            {showUrlInput && (
                                <div className="absolute right-0 -top-12 md:top-full md:mt-2 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-96 z-20">
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={importUrl}
                                            onChange={(e) => setImportUrl(e.target.value)}
                                            placeholder="Paste YouTube URL for subtitles, or article URL to read..."
                                            className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
                                            disabled={isImporting}
                                        />
                                        <button
                                            onClick={handleUrlImport}
                                            disabled={isImporting}
                                            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isImporting ? 'Importing...' : 'Import'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Import YouTube subtitles or article content
                                    </p>
                                </div>
                            )}
                            <button
                                onClick={() => setShowUrlInput(!showUrlInput)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                <Link2 className="w-5 h-5" />
                                <span>URL Import</span>
                            </button>
                        </div>

                        <label className={`flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            <span>{isUploading ? 'Uploading...' : 'Upload PDF / EPUB'}</span>
                            <input
                                type="file"
                                accept=".pdf,.epub"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                            />
                        </label>
                    </div>
                </div>

                {/* Library Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    </div>
                ) : library.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                        <Book className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No books yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Upload a PDF or EPUB to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {library.map(item => {
                            const thumbnail = getThumbnailUrl(item);
                            const displayTitle = getDisplayTitle(item);
                            const typeLabel = getTypeLabel(item.file_type);

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => onNavigate('reader', { libraryId: item.id, title: item.title })}
                                    className="group cursor-pointer bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 hover:border-yellow-500/50 hover:shadow-lg transition-all"
                                >
                                    <div className="relative aspect-video bg-gray-200 dark:bg-gray-800">
                                        {thumbnail ? (
                                            <img
                                                src={thumbnail}
                                                alt={displayTitle}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect fill="%23374151" width="320" height="180"/><text fill="%239CA3AF" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14">No Thumbnail</text></svg>';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-amber-50 to-amber-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                                                <FileText className="w-10 h-10 text-amber-400 dark:text-gray-500" />
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                                <BookOpen size={20} className="text-white" />
                                            </div>
                                        </div>

                                        <div className="absolute top-3 left-3 px-2 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-gray-700 dark:bg-gray-900/80 dark:text-gray-200">
                                            {typeLabel}
                                        </div>

                                        <button
                                            onClick={(e) => handleDelete(e, item.id)}
                                            className="absolute top-3 right-3 p-2 text-gray-600 hover:text-red-500 transition-colors rounded-full bg-white/90 dark:bg-gray-900/80 hover:bg-white dark:hover:bg-gray-800"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="p-4">
                                        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2" title={displayTitle}>
                                            {displayTitle}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                            {formatTimeAgo(item.created_at)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
