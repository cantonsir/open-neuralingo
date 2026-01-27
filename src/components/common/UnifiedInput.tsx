import React, { useState, useRef } from 'react';
import { Upload, Plus, X, FileText, BookOpen } from 'lucide-react';
// LibraryItem type is defined locally in Props or can be imported if central types are updated.
// For now, removing the invalid import.

// Define locally to avoid dependency issues if types are scattered
interface UnifiedInputProps {
    value: string;
    onChange: (value: string) => void;
    contextId?: string;
    onClearContext: () => void;
    library: { id: string; title: string }[];
    onContextSelect: (id: string) => void;
    onFileUpload: (file: File) => Promise<void>;
    isUploading?: boolean;
    themeColor?: 'emerald' | 'amber' | 'purple' | 'blue' | 'indigo';
    placeholder?: string;
    className?: string;
}

export default function UnifiedInput({
    value,
    onChange,
    contextId,
    onClearContext,
    library,
    onContextSelect,
    onFileUpload,
    isUploading = false,
    themeColor = 'blue',
    placeholder = "Enter your text here...",
    className = ""
}: UnifiedInputProps) {
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Theme Configuration
    const theme = {
        emerald: {
            ring: 'focus-within:ring-emerald-500/50',
            chipBg: 'bg-emerald-50 dark:bg-emerald-900/30',
            chipText: 'text-emerald-700 dark:text-emerald-300',
            chipBorder: 'border-emerald-100 dark:border-emerald-800',
            chipHover: 'hover:bg-emerald-100 dark:hover:bg-emerald-800',
            iconHover: 'hover:text-emerald-600 hover:bg-emerald-50',
            iconColor: 'text-emerald-500',
        },
        amber: {
            ring: 'focus-within:ring-amber-500/50',
            chipBg: 'bg-amber-50 dark:bg-amber-900/30',
            chipText: 'text-amber-700 dark:text-amber-300',
            chipBorder: 'border-amber-100 dark:border-amber-800',
            chipHover: 'hover:bg-amber-100 dark:hover:bg-amber-800',
            iconHover: 'hover:text-amber-600 hover:bg-amber-50',
            iconColor: 'text-amber-500',
        },
        purple: {
            ring: 'focus-within:ring-purple-500/50',
            chipBg: 'bg-purple-50 dark:bg-purple-900/30',
            chipText: 'text-purple-700 dark:text-purple-300',
            chipBorder: 'border-purple-100 dark:border-purple-800',
            chipHover: 'hover:bg-purple-100 dark:hover:bg-purple-800',
            iconHover: 'hover:text-purple-600 hover:bg-purple-50',
            iconColor: 'text-purple-500',
        },
        blue: {
            ring: 'focus-within:ring-blue-500/50',
            chipBg: 'bg-blue-50 dark:bg-blue-900/30',
            chipText: 'text-blue-700 dark:text-blue-300',
            chipBorder: 'border-blue-100 dark:border-blue-800',
            chipHover: 'hover:bg-blue-100 dark:hover:bg-blue-800',
            iconHover: 'hover:text-blue-600 hover:bg-blue-50',
            iconColor: 'text-blue-500',
        },
        indigo: {
            ring: 'focus-within:ring-indigo-500/50',
            chipBg: 'bg-indigo-50 dark:bg-indigo-900/30',
            chipText: 'text-indigo-700 dark:text-indigo-300',
            chipBorder: 'border-indigo-100 dark:border-indigo-800',
            chipHover: 'hover:bg-indigo-100 dark:hover:bg-indigo-800',
            iconHover: 'hover:text-indigo-600 hover:bg-indigo-50',
            iconColor: 'text-indigo-500',
        }
    }[themeColor];

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await onFileUpload(file);
            setShowAttachMenu(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const contextTitle = library.find(l => l.id === contextId)?.title || "Unknown Context";

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all focus-within:ring-2 ${theme.ring} ${className}`}>

            {/* Context Attachment Chip */}
            {contextId && (
                <div className="px-4 pt-4">
                    <div className={`inline-flex items-center gap-2 ${theme.chipBg} ${theme.chipText} px-3 py-1.5 rounded-lg text-sm border ${theme.chipBorder}`}>
                        <FileText className="w-4 h-4" />
                        <span className="font-medium max-w-[200px] truncate">
                            {contextTitle}
                        </span>
                        <button
                            onClick={onClearContext}
                            className={`${theme.chipHover} rounded-full p-0.5 ml-1 transition-colors`}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}

            {/* Text Input */}
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full p-4 bg-transparent border-none focus:ring-0 outline-none resize-none min-h-[120px] text-lg placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
            />

            {/* Toolbar */}
            <div className="px-4 pb-3 flex items-center justify-between">
                <div className="relative">
                    <button
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        className={`p-2 text-gray-500 ${theme.iconHover} dark:hover:bg-gray-700 rounded-full transition-colors`}
                        title="Add context"
                    >
                        <Plus className="w-6 h-6" />
                    </button>

                    {/* Attachment Menu */}
                    {showAttachMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
                            <div className="p-2 space-y-1">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200"
                                >
                                    <Upload className={`w-4 h-4 ${theme.iconColor}`} />
                                    {isUploading ? "Uploading..." : "Upload File (PDF/EPUB)"}
                                </button>

                                <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>

                                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    From Library
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                    {library.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-gray-400 italic">Library is empty</div>
                                    ) : (
                                        library.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    onContextSelect(item.id);
                                                    setShowAttachMenu(false);
                                                }}
                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 truncate"
                                            >
                                                <BookOpen className={`w-3 h-3 ${theme.iconColor}`} />
                                                <span className="truncate">{item.title}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-xs text-gray-400">
                    {value.length} chars
                </div>
            </div>

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.epub"
                className="hidden"
            />
        </div>
    );
}
