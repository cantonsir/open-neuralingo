import React, { useState } from 'react';
import {
    ChevronRight,
    ChevronLeft,
    Check,
    Globe,
    PenTool,
    Gauge,
    Target,
    AlertTriangle,
    Sparkles,
} from 'lucide-react';
import {
    languages,
    writingLevelDescriptions,
    writingPurposes,
    writingDifficulties,
    writingGoals,
} from './writingProfileData';
import { useFirstLanguage } from '../../hooks/useFirstLanguage';

export interface WritingProfileData {
    id?: string;
    targetLanguage: string;
    firstLanguage: string;
    writingLevel: number;
    writingPurposes: string[];
    difficulties: string[];
    goals: string[];
    interests: string;
    completedAt: number;
}

interface WritingProfileProps {
    onComplete: (profile: WritingProfileData) => void;
    cachedProfile?: WritingProfileData | null;
}

const WritingProfile: React.FC<WritingProfileProps> = ({ onComplete, cachedProfile }) => {
    const { firstLanguage: savedFirstLanguage } = useFirstLanguage();
    const [step, setStep] = useState(0);
    const [profile, setProfile] = useState<Partial<WritingProfileData>>(
        cachedProfile || {
            targetLanguage: 'en',
            firstLanguage: savedFirstLanguage || 'en',
            writingLevel: 2,
            writingPurposes: [],
            difficulties: [],
            goals: [],
            interests: '',
        }
    );

    const totalSteps = 7;

    const handleNext = () => {
        if (step < totalSteps - 1) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    const handleComplete = () => {
        const completedProfile: WritingProfileData = {
            targetLanguage: profile.targetLanguage!,
            firstLanguage: profile.firstLanguage!,
            writingLevel: profile.writingLevel!,
            writingPurposes: profile.writingPurposes!,
            difficulties: profile.difficulties!,
            goals: profile.goals!,
            interests: profile.interests!,
            completedAt: Date.now(),
        };
        onComplete(completedProfile);
    };

    const toggleArrayItem = (key: keyof WritingProfileData, value: string) => {
        const current = (profile[key] as string[]) || [];
        setProfile({
            ...profile,
            [key]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
        });
    };

    const canProceed = () => {
        switch (step) {
            case 0:
                return !!profile.targetLanguage;
            case 1:
                return !!profile.firstLanguage;
            case 2:
                return profile.writingLevel !== undefined;
            case 3:
                return (profile.writingPurposes?.length || 0) > 0;
            case 4:
                return (profile.difficulties?.length || 0) > 0;
            case 5:
                return (profile.goals?.length || 0) > 0;
            case 6:
                return true;
            default:
                return false;
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PenTool className="w-5 h-5 text-purple-600" />
                        Writing Profile
                    </h2>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Step {step + 1} of {totalSteps}
                    </div>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-purple-600 transition-all duration-300"
                        style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-2xl mx-auto">
                    {step === 0 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        What language are you learning to write?
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Select your target language for writing assessment.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {languages.map(lang => (
                                    <button
                                        key={lang.id}
                                        onClick={() => setProfile({ ...profile, targetLanguage: lang.id })}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.targetLanguage === lang.id
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{lang.flag}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{lang.label}</span>
                                            {profile.targetLanguage === lang.id && (
                                                <Check className="w-5 h-5 text-purple-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        What is your first language?
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    We will show translation prompts in this language during your mini-test.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {languages.map(lang => (
                                    <button
                                        key={lang.id}
                                        onClick={() => setProfile({ ...profile, firstLanguage: lang.id })}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.firstLanguage === lang.id
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{lang.flag}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{lang.label}</span>
                                            {profile.firstLanguage === lang.id && (
                                                <Check className="w-5 h-5 text-purple-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Gauge className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Current Writing Level
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    How would you rate your current writing ability?
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                    <div className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                        Level {(profile.writingLevel || 0) + 1}: {writingLevelDescriptions[profile.writingLevel || 0]}
                                    </div>
                                </div>

                                <input
                                    type="range"
                                    min="0"
                                    max="4"
                                    value={profile.writingLevel || 0}
                                    onChange={e => setProfile({ ...profile, writingLevel: parseInt(e.target.value, 10) })}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />

                                <div className="space-y-2 mt-6">
                                    {writingLevelDescriptions.map((desc, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-lg text-sm ${
                                                profile.writingLevel === idx
                                                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-100 border border-purple-200 dark:border-purple-800'
                                                    : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                        >
                                            <span className="font-medium">Level {idx + 1}:</span> {desc}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <PenTool className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Writing Purposes
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    What types of writing do you want to improve? (Select all that apply)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {writingPurposes.map(purpose => (
                                    <button
                                        key={purpose.id}
                                        onClick={() => toggleArrayItem('writingPurposes', purpose.id)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.writingPurposes?.includes(purpose.id)
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{purpose.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                {purpose.label}
                                            </span>
                                            {profile.writingPurposes?.includes(purpose.id) && (
                                                <Check className="w-5 h-5 text-purple-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Main Writing Difficulties
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    What challenges do you face when writing? (Select all that apply)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {writingDifficulties.map(diff => (
                                    <button
                                        key={diff.id}
                                        onClick={() => toggleArrayItem('difficulties', diff.id)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.difficulties?.includes(diff.id)
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{diff.icon}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                {diff.label}
                                            </span>
                                            {profile.difficulties?.includes(diff.id) && (
                                                <Check className="w-5 h-5 text-purple-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Target className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Writing Goals
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Why do you want to improve your writing? (Select all that apply)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {writingGoals.map(goal => (
                                    <button
                                        key={goal.id}
                                        onClick={() => toggleArrayItem('goals', goal.id)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.goals?.includes(goal.id)
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{goal.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                {goal.label}
                                            </span>
                                            {profile.goals?.includes(goal.id) && (
                                                <Check className="w-5 h-5 text-purple-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 6 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Specific Interests
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Tell us what you want to write about (optional). This helps us personalize translation prompts.
                                </p>
                            </div>

                            <textarea
                                value={profile.interests || ''}
                                onChange={e => setProfile({ ...profile, interests: e.target.value })}
                                placeholder="e.g., Business email communication, travel journaling, academic essay writing..."
                                className="w-full h-32 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
                            />

                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                                <p className="text-sm text-purple-900 dark:text-purple-100">
                                    <strong>Tip:</strong> More detail gives better sentence topics in your mini-test.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={step === 0}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Back
                    </button>

                    {step < totalSteps - 1 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleComplete}
                            disabled={!canProceed()}
                            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Check className="w-5 h-5" />
                            Complete Profile
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WritingProfile;
