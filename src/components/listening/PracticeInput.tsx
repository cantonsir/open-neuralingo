/**
 * PracticeInput Component
 *
 * A command-aware textarea input for the Practice Generator.
 * Supports slash commands (/plan, /fast) with autocomplete suggestions.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Command, Zap, FileText } from 'lucide-react';
import {
    parseCommand,
    isCommandPrefix,
    getCommandSuggestions,
    type ParsedCommand
} from '../../services/practiceCommandService';

interface PracticeInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (prompt: string) => void;
    onPlanCommand: (prompt: string) => void;
    onFastToggle: () => void;
    isFastMode: boolean;
    isGenerating: boolean;
    placeholder?: string;
}

const PracticeInput: React.FC<PracticeInputProps> = ({
    value,
    onChange,
    onSubmit,
    onPlanCommand,
    onFastToggle,
    isFastMode,
    isGenerating,
    placeholder = 'Describe the dialogue you want to generate...'
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<{ command: string; description: string }[]>([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [commandDetected, setCommandDetected] = useState<ParsedCommand | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Update suggestions when input changes
    useEffect(() => {
        if (isCommandPrefix(value)) {
            const newSuggestions = getCommandSuggestions(value);
            setSuggestions(newSuggestions);
            setShowSuggestions(newSuggestions.length > 0);
            setSelectedSuggestionIndex(0);
        } else {
            setShowSuggestions(false);
            setSuggestions([]);
        }

        // Parse command
        const parsed = parseCommand(value);
        setCommandDetected(parsed.type !== 'none' ? parsed : null);
    }, [value]);

    // Handle keyboard navigation for suggestions
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                if (showSuggestions) {
                    e.preventDefault();
                    const selected = suggestions[selectedSuggestionIndex];
                    if (selected) {
                        onChange(selected.command + ' ');
                        setShowSuggestions(false);
                    }
                    return;
                }
            }
        }

        // Submit on Ctrl+Enter or Cmd+Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    }, [showSuggestions, suggestions, selectedSuggestionIndex, onChange]);

    // Handle form submission
    const handleSubmit = useCallback(() => {
        if (isGenerating || !value.trim()) return;

        const parsed = parseCommand(value);

        switch (parsed.type) {
            case 'plan':
                onPlanCommand(parsed.args);
                break;
            case 'fast':
                onFastToggle();
                onChange(''); // Clear input after /fast command
                break;
            case 'none':
            default:
                onSubmit(value.trim());
                break;
        }
    }, [value, isGenerating, onSubmit, onPlanCommand, onFastToggle, onChange]);

    // Select a suggestion
    const selectSuggestion = (index: number) => {
        const selected = suggestions[index];
        if (selected) {
            onChange(selected.command + ' ');
            setShowSuggestions(false);
            textareaRef.current?.focus();
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [value]);

    return (
        <div className="relative">
            {/* Command hint banner */}
            {commandDetected && (
                <div className={`mb-2 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                    commandDetected.type === 'plan'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                    {commandDetected.type === 'plan' ? (
                        <>
                            <FileText size={14} />
                            <span>Plan Mode: Preview generation strategy before creating</span>
                        </>
                    ) : (
                        <>
                            <Zap size={14} />
                            <span>Fast Mode: Toggle between Standard and Fast model</span>
                        </>
                    )}
                </div>
            )}

            {/* Main input area */}
            <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={isGenerating}
                    rows={3}
                    className="w-full px-4 py-3 pr-24 bg-transparent resize-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
                />

                {/* Command indicator and submit button */}
                <div className="absolute right-2 bottom-2 flex items-center gap-2">
                    {/* Command hint */}
                    {!value && (
                        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <Command size={12} />
                            <span>/plan /fast</span>
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        onClick={handleSubmit}
                        disabled={isGenerating || !value.trim()}
                        className={`p-2 rounded-lg transition-colors ${
                            isGenerating || !value.trim()
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                : commandDetected?.type === 'plan'
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : commandDetected?.type === 'fast'
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                        }`}
                        title={
                            commandDetected?.type === 'plan'
                                ? 'Generate Plan'
                                : commandDetected?.type === 'fast'
                                    ? 'Toggle Fast Mode'
                                    : 'Generate Dialogue'
                        }
                    >
                        {commandDetected?.type === 'plan' ? (
                            <FileText size={18} />
                        ) : commandDetected?.type === 'fast' ? (
                            <Zap size={18} />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
            </div>

            {/* Command suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-10 overflow-hidden">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.command}
                            onClick={() => selectSuggestion(index)}
                            className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${
                                index === selectedSuggestionIndex
                                    ? 'bg-amber-50 dark:bg-amber-900/20'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                            <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">
                                {suggestion.command}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {suggestion.description}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Keyboard shortcut hint */}
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>
                    Type <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">/</code> for commands
                </span>
                <span>
                    <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Ctrl+Enter</code> to submit
                </span>
            </div>
        </div>
    );
};

export default PracticeInput;
