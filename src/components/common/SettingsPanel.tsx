import React, { useState, useEffect } from 'react';
import { X, Sun, Moon, Keyboard, Globe } from 'lucide-react';
import { Theme } from '../../types';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    toggleTheme: () => void;
    targetLanguage: string;
    onLanguageChange: (language: string) => void;
    firstLanguage?: string;
    onFirstLanguageChange?: (language: string) => void;
}

const shortcuts = [
    { key: 'Space', action: 'Create marker at current subtitle' },
    { key: 'S', action: 'Peek subtitles (hold)' },
    { key: 'K / P', action: 'Play/Pause video' },
    { key: '←', action: 'Previous sentence' },
    { key: '→', action: 'Next sentence' },
];

// Common languages with emoji flags
const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh-CN', name: 'Simplified Chinese', flag: '🇨🇳' },
    { code: 'zh-TW', name: 'Traditional Chinese', flag: '🇹🇼' },
    { code: 'yue', name: 'Cantonese', flag: '🇭🇰' },
    { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
];

export default function SettingsPanel({
    isOpen,
    onClose,
    theme,
    toggleTheme,
    targetLanguage,
    onLanguageChange,
    firstLanguage = 'en',
    onFirstLanguageChange
}: SettingsPanelProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'shortcuts'>('general');

    if (!isOpen) return null;

    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage) || SUPPORTED_LANGUAGES[0];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-800">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'general'
                            ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-500'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('shortcuts')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'shortcuts'
                            ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-500'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Shortcuts
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            {/* Learning Language */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <Globe size={20} className="text-blue-500" />
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">Learning Language</div>
                                        <div className="text-sm text-gray-500">The language you want to learn</div>
                                    </div>
                                </div>
                                <select
                                    value={targetLanguage}
                                    onChange={(e) => onLanguageChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                >
                                    {SUPPORTED_LANGUAGES.map(lang => (
                                        <option key={lang.code} value={lang.code}>
                                            {lang.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-400 mt-2">
                                    Videos will fetch subtitles in this language when available
                                </p>
                            </div>

                            {/* User's First Language */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <Globe size={20} className="text-green-500" />
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">Your Native Language</div>
                                        <div className="text-sm text-gray-500">Used for translations and definitions</div>
                                    </div>
                                </div>
                                <select
                                    value={firstLanguage}
                                    onChange={(e) => onFirstLanguageChange?.(e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    {SUPPORTED_LANGUAGES.map(lang => (
                                        <option key={lang.code} value={lang.code}>
                                            {lang.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-400 mt-2">
                                    Vocabulary definitions and sentence translations will be shown in this language
                                </p>
                            </div>

                            {/* Theme Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    {theme === 'dark' ? <Moon size={20} className="text-blue-400" /> : <Sun size={20} className="text-yellow-500" />}
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">Appearance</div>
                                        <div className="text-sm text-gray-500">{theme === 'dark' ? 'Dark' : 'Light'} mode</div>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleTheme}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-yellow-500' : 'bg-gray-300'
                                        }`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>

                            {/* App Info */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                <div className="font-medium text-gray-900 dark:text-white mb-1">EchoLoop</div>
                                <div className="text-sm text-gray-500">Deep Listening Trainer</div>
                                <div className="text-xs text-gray-400 mt-2">Version 1.0.0</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'shortcuts' && (
                        <div className="space-y-2">
                            {shortcuts.map((shortcut, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                                >
                                    <span className="text-sm text-gray-600 dark:text-gray-400">{shortcut.action}</span>
                                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
                                        {shortcut.key}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
