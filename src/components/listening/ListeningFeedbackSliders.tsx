import React from 'react';

export interface SliderValues {
    wordBoundaries: number | null;  // 1-3 or null if not selected
    familiarity: number | null;     // 1-3 or null if not selected (severity of unfamiliarity)
    meaningClarity: number | null;  // 1-3 or null if not selected
    wordConfusion: number | null;   // 1-3 or null if not selected
}

interface CategoryConfig {
    key: keyof SliderValues;
    label: string;
    tooltip: string;
    icon: string;
    defaultValue: number;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
    {
        key: 'wordBoundaries',
        label: 'Word Boundaries',
        tooltip: 'Words blend together, hard to tell where one ends',
        icon: '🔗',
        defaultValue: 2
    },
    {
        key: 'familiarity',
        label: 'Unfamiliar Word',
        tooltip: 'Never heard this word/phrase before',
        icon: '❓',
        defaultValue: 2
    },
    {
        key: 'meaningClarity',
        label: 'Unclear Meaning',
        tooltip: 'Heard it but didn\'t understand the meaning',
        icon: '💭',
        defaultValue: 2
    },
    {
        key: 'wordConfusion',
        label: 'Misheard Word',
        tooltip: 'Thought it was a different word',
        icon: '🔀',
        defaultValue: 2
    }
];

const LEVEL_TOOLTIPS: Record<keyof SliderValues, string[]> = {
    wordBoundaries: [
        '',
        '1 = Blended (very hard to separate words)',
        '2 = Unclear (sometimes hard to separate)',
        '3 = Slightly unclear (mostly separable)'
    ],
    familiarity: [
        '',
        '1 = Totally unfamiliar (brand new)',
        '2 = Unfamiliar',
        '3 = Slightly unfamiliar'
    ],
    meaningClarity: [
        '',
        '1 = No idea',
        '2 = Unclear meaning',
        '3 = Slight meaning (almost understood)'
    ],
    wordConfusion: [
        '',
        '1 = Very confused (misheard a lot)',
        '2 = Confused (some mishearing)',
        '3 = Slight confusion'
    ],
};

export const DEFAULT_SLIDER_VALUES: SliderValues = {
    wordBoundaries: null,
    familiarity: null,
    meaningClarity: null,
    wordConfusion: null
};

interface ListeningFeedbackSlidersProps {
    values: SliderValues;
    onChange: (values: SliderValues) => void;
    onSubmit: () => void;
    submitLabel?: string;
}

export default function ListeningFeedbackSliders({
    values,
    onChange,
    onSubmit,
    submitLabel = 'Continue'
}: ListeningFeedbackSlidersProps) {
    // Toggle category selection
    const toggleCategory = (key: keyof SliderValues) => {
        const config = CATEGORY_CONFIGS.find(c => c.key === key);
        if (!config) return;
        
        if (values[key] !== null) {
            // Deselect
            onChange({ ...values, [key]: null });
        } else {
            // Select with default value
            onChange({ ...values, [key]: config.defaultValue });
        }
    };

    // Change level for a selected category
    const setLevel = (key: keyof SliderValues, level: number) => {
        onChange({ ...values, [key]: level });
    };

    // Check if at least one category is selected
    const hasSelection = Object.values(values).some(v => v !== null);

    return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                What made it hard to understand?
            </p>

            {/* Category Labels Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {CATEGORY_CONFIGS.map((config) => {
                    const isSelected = values[config.key] !== null;
                    return (
                        <button
                            key={config.key}
                            onClick={() => toggleCategory(config.key)}
                            title={config.tooltip}
                            className={`relative px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                                isSelected
                                    ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-2 border-yellow-400 dark:border-yellow-600 shadow-sm'
                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                        >
                            <span className="mr-1.5">{config.icon}</span>
                            {config.label}
                            {isSelected && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                                    ✓
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Level Pickers for Selected Categories */}
            {hasSelection && (
                <div className="space-y-3 mb-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Adjust severity (optional):
                    </p>
                    {CATEGORY_CONFIGS.map((config) => {
                        const value = values[config.key];
                        if (value === null) return null;
                        
                        return (
                            <div key={config.key} className="flex items-center gap-3">
                                <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[120px]">
                                    {config.label}
                                </span>
                                <div className="flex-1">
                                    <div className="flex gap-1.5 justify-end">
                                        {[1, 2, 3].map((level) => (
                                            <button
                                                key={level}
                                                onClick={() => setLevel(config.key, level)}
                                                title={LEVEL_TOOLTIPS[config.key][level]}
                                                className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                                                    value === level
                                                        ? 'bg-yellow-500 text-white shadow-md scale-110'
                                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                                }`}
                                            >
                                                {level}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Submit Button */}
            <button
                onClick={onSubmit}
                disabled={!hasSelection}
                className={`w-full py-3 font-semibold rounded-xl transition-all ${
                    hasSelection
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
            >
                {submitLabel}
            </button>
        </div>
    );
}
