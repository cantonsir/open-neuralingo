import React, { useState, useRef, useEffect } from 'react';
import { Upload, Plus, X, FileText, BookOpen, Link as LinkIcon, Zap, Brain, ChevronDown, Paperclip, Send } from 'lucide-react';

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
    // New Props for "Professional" Mode
    mode?: 'fast' | 'plan';
    onModeChange?: (mode: 'fast' | 'plan') => void;
    url?: string;
    onUrlChange?: (url: string) => void;
    onSubmit?: () => void;
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
    className = "",
    mode,
    onModeChange,
    url,
    onUrlChange,
    onSubmit
}: UnifiedInputProps) {
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Context title helper
    const contextTitle = library.find(l => l.id === contextId)?.title || "Unknown Context";

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await onFileUpload(file);
            setShowAttachMenu(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Toggle helpers to ensure mutual exclusivity
    const toggleAttach = () => {
        if (!showAttachMenu) setShowLinkInput(false);
        setShowAttachMenu(!showAttachMenu);
    };

    const toggleLink = () => {
        if (!showLinkInput) setShowAttachMenu(false);
        setShowLinkInput(!showLinkInput);
    };

    // Submit handler
    const handleSubmit = () => {
        if ((value.trim() || contextId || url) && onSubmit) {
            onSubmit();
        }
    };

    // Theme definitions (extended for gradients usually)
    const getThemeColors = () => {
        switch (themeColor) {
            case 'amber': return 'from-amber-500 to-orange-600 text-amber-600';
            case 'emerald': return 'from-emerald-500 to-green-600 text-emerald-600';
            case 'purple': return 'from-purple-500 to-pink-600 text-purple-600';
            case 'indigo': return 'from-indigo-500 to-blue-600 text-indigo-600';
            default: return 'from-blue-500 to-cyan-600 text-blue-600';
        }
    };

    return (
        <div className={`group relative bg-white dark:bg-gray-800 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700/50 ${className}`}>

            {/* Gradient Border Overlay (Optional "glow" effect on focus or simple border) */}
            {/* Gradient Border Overlay (Optional "glow" effect on focus or simple border) - REMOVED for clean white look */}
            {/* <div className={`absolute inset-0 ...`} /> */}

            {/* Top Bar: Mode Selector & Context Chips */}
            <div className="px-5 pt-4 flex items-center justify-between gap-3">

                {/* Mode Selector (Only if supported) */}
                {mode && onModeChange && (
                    <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1 rounded-full border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => onModeChange('fast')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === 'fast'
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <Zap className="w-4 h-4" fill={mode === 'fast' ? "currentColor" : "none"} />
                            <span className="hidden sm:inline">Fast</span>
                        </button>
                        <button
                            onClick={() => onModeChange('plan')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === 'plan'
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <Brain className="w-4 h-4" />
                            <span className="hidden sm:inline">Plan</span>
                        </button>
                    </div>
                )}

                {/* Context Chip */}
                <div className="flex-1 flex justify-end gap-2 overflow-hidden">
                    {contextId && (
                        <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-xl text-sm border border-amber-100 dark:border-amber-800 animate-in fade-in slide-in-from-right-4">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="font-medium max-w-[150px] truncate">{contextTitle}</span>
                            <button onClick={onClearContext} className="hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-full p-0.5 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    {url && (
                        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-xl text-sm border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-right-4">
                            <LinkIcon className="w-3.5 h-3.5" />
                            <span className="font-medium max-w-[150px] truncate">{url}</span>
                            <button onClick={() => onUrlChange && onUrlChange('')} className="hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-full p-0.5 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Input Area */}
            <div className="px-2">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    placeholder={placeholder}
                    className="w-full p-4 bg-transparent border-none focus:ring-0 outline-none resize-none min-h-[80px] text-lg text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 leading-relaxed scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700"
                    rows={1}
                />
            </div>

            {/* Bottom Toolbar */}
            <div className="px-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Add Context / Attachment */}
                    <div className="relative">
                        <button
                            onClick={toggleAttach}
                            className={`p-2.5 rounded-full transition-all active:scale-95 ${showAttachMenu
                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                                : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                }`}
                            title="Add context"
                        >
                            <Plus className={`w-5 h-5 stroke-[2.5] transition-transform ${showAttachMenu ? 'rotate-45' : ''}`} />
                        </button>

                        {/* Attachment Menu Popup */}
                        {showAttachMenu && (
                            <div className="absolute left-0 bottom-full mb-3 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 origin-bottom-left">
                                <div className="p-2 space-y-1">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                                    >
                                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                            <Upload className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                        </div>
                                        {isUploading ? "Uploading..." : "Upload PDF/EPUB"}
                                    </button>



                                    <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3 my-1"></div>

                                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">From Library</div>
                                    <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
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
                                                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 truncate group/item"
                                                >
                                                    <BookOpen className="w-4 h-4 text-gray-400 group-hover/item:text-amber-500 transition-colors" />
                                                    <span className="truncate">{item.title}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* URL Input Toggle */}
                    {onUrlChange && (
                        <div className="relative">
                            <button
                                onClick={toggleLink}
                                className={`p-2.5 rounded-full transition-all active:scale-95 ${showLinkInput
                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                    }`}
                                title="Add URL Link"
                            >
                                <LinkIcon className="w-5 h-5 stroke-[2.5]" />
                            </button>

                            {/* Simple URL Input Popover */}
                            {showLinkInput && (
                                <div className="absolute left-0 bottom-full mb-3 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-20 animate-in fade-in slide-in-from-bottom-2 origin-bottom-left">
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-700 focus-within:ring-2 ring-blue-500/30 transition-all">
                                        <LinkIcon className="w-4 h-4 text-gray-400" />
                                        <input
                                            autoFocus
                                            type="url"
                                            value={url || ''}
                                            onChange={(e) => onUrlChange(e.target.value)}
                                            placeholder="Paste URL here..."
                                            className="bg-transparent border-none outline-none text-sm w-full text-gray-800 dark:text-gray-200 placeholder-gray-400"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    setShowLinkInput(false);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium transition-colors ${value.length > 500 ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}`}>
                        {value.length} chars
                    </span>

                    {/* Send / Action Button - NOW CLICKABLE */}
                    <button
                        onClick={handleSubmit}
                        disabled={(!value.trim() && !contextId && !url) || !onSubmit}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${(value.trim() || contextId || url) && onSubmit
                            ? `bg-gradient-to-r ${getThemeColors()} text-white scale-100 hover:scale-105 active:scale-95 cursor-pointer`
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                            }`}
                        title="Generate"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
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
        </div >
    );
}
