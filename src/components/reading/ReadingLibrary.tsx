import React, { useState, useEffect } from 'react';
import { Book, Plus, Upload, Trash2, FileText, Loader2, Youtube } from 'lucide-react';
import { View } from '../../types';

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
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [youtubeUrl, setYoutubeUrl] = useState('');

    useEffect(() => {
        fetchLibrary();
    }, []);

    const fetchLibrary = async () => {
        try {
            const res = await fetch('/api/library');
            if (res.ok) {
                const data = await res.json();
                setLibrary(data);
            }
        } catch (error) {
            console.error('Failed to fetch library:', error);
        } finally {
            setIsLoading(false);
        }
    };

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

    const handleYoutubeImport = async () => {
        if (!youtubeUrl) return;

        // Extract ID
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = youtubeUrl.match(regExp);
        const id = (match && match[2].length === 11) ? match[2] : null;

        if (!id) {
            alert("Invalid YouTube URL");
            return;
        }

        setIsUploading(true);
        try {
            const res = await fetch('/api/library/import/youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: id })
            });

            if (res.ok) {
                setYoutubeUrl('');
                setShowUrlInput(false);
                await fetchLibrary();
            } else {
                alert("Failed to import transcript");
            }
        } catch (e) {
            console.error(e);
            alert("Import failed");
        } finally {
            setIsUploading(false);
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
                        <div className="relative">
                            {showUrlInput && (
                                <div className="absolute right-0 -top-12 md:top-full md:mt-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex gap-2 w-80 z-20">
                                    <input
                                        type="text"
                                        value={youtubeUrl}
                                        onChange={(e) => setYoutubeUrl(e.target.value)}
                                        placeholder="Paste YouTube URL..."
                                        className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 text-sm"
                                        onKeyDown={(e) => e.key === 'Enter' && handleYoutubeImport()}
                                    />
                                    <button
                                        onClick={handleYoutubeImport}
                                        disabled={isUploading}
                                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                                    >
                                        Import
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => setShowUrlInput(!showUrlInput)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                                <Youtube className="w-5 h-5" />
                                <span>YouTube Import</span>
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
                        {library.map(item => (
                            <div
                                key={item.id}
                                onClick={() => onNavigate('reader', { libraryId: item.id, title: item.title })}
                                className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all cursor-pointer flex flex-col"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(e, item.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-1" title={item.title}>
                                    {item.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                                    {item.file_type}
                                </p>

                                <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-400">
                                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                    <span className="group-hover:text-amber-500 transition-colors flex items-center gap-1">
                                        Read Now <span className="text-lg">→</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
