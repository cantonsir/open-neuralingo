import React from 'react';

export interface SliderValues {
    wordBoundaries: number;  // 1-5: How easy to hear word boundaries
    familiarity: number;     // 1-5: How familiar the word/phrase felt
    meaningClarity: number;  // 1-5: How clear the meaning was
    wordConfusion: number;   // 1-5: Did it sound like a different word (5 = no confusion)
}

interface SliderConfig {
    key: keyof SliderValues;
    label: string;
    tooltip: string;
    leftLabel: string;
    rightLabel: string;
    defaultValue: number;
}

const SLIDER_CONFIGS: SliderConfig[] = [
    {
        key: 'wordBoundaries',
        label: 'Word Boundaries',
        tooltip: 'How easy was it to hear where one word ends and the next begins?',
        leftLabel: 'All blended',
        rightLabel: 'Clear boundaries',
        defaultValue: 3
    },
    {
        key: 'familiarity',
        label: 'Familiarity',
        tooltip: 'How familiar did this word or phrase feel when you heard it?',
        leftLabel: 'Completely new',
        rightLabel: 'Very familiar',
        defaultValue: 3
    },
    {
        key: 'meaningClarity',
        label: 'Meaning Clarity',
        tooltip: 'How clear was the meaning at that moment?',
        leftLabel: 'No idea',
        rightLabel: 'Fully understood',
        defaultValue: 3
    },
    {
        key: 'wordConfusion',
        label: 'Word Confusion',
        tooltip: 'Did this sound like a different word to you?',
        leftLabel: 'Very confused',
        rightLabel: 'No confusion',
        defaultValue: 5
    }
];

export const DEFAULT_SLIDER_VALUES: SliderValues = {
    wordBoundaries: 3,
    familiarity: 3,
    meaningClarity: 3,
    wordConfusion: 5
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
    const handleSliderChange = (key: keyof SliderValues, value: number) => {
        onChange({ ...values, [key]: value });
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 mb-4">
            {SLIDER_CONFIGS.map((config, index) => (
                <div key={config.key} className={index < SLIDER_CONFIGS.length - 1 ? 'mb-5' : 'mb-6'}>
                    <div className="flex justify-between items-center mb-2">
                        <span 
                            className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-help border-b border-dashed border-gray-400"
                            title={config.tooltip}
                        >
                            {config.label}
                        </span>
                        <span className="text-sm text-yellow-600 dark:text-yellow-400 font-semibold">
                            {values[config.key]}/5
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={values[config.key]}
                        onChange={(e) => handleSliderChange(config.key, Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{config.leftLabel}</span>
                        <span>{config.rightLabel}</span>
                    </div>
                </div>
            ))}

            {/* Submit Button */}
            <button
                onClick={onSubmit}
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all"
            >
                {submitLabel}
            </button>
        </div>
    );
}
