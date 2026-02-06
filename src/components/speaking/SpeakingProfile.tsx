import React, { useState } from 'react';
import {
    ChevronRight,
    ChevronLeft,
    Check,
    Globe,
    Mic,
    Gauge,
    Target,
    AlertTriangle,
    Sparkles
} from 'lucide-react';
import {
    languages,
    speakingLevelDescriptions,
    contextPreferences,
    speakingComfortOptions,
    speakingDifficulties,
    speakingGoals
} from './speakingProfileData';
import { useFirstLanguage } from '../../hooks/useFirstLanguage';

export interface SpeakingProfileData {
    id?: string;
    targetLanguage: string;
    firstLanguage: string;
    speakingLevel: number;
    contextPreferences: string[];
    speakingComfort: string;
    difficulties: string[];
    goals: string[];
    interests: string;
    completedAt: number;
}

interface SpeakingProfileProps {
    onComplete: (profile: SpeakingProfileData) => void;
    cachedProfile?: SpeakingProfileData | null;
}

const SpeakingProfile: React.FC<SpeakingProfileProps> = ({ onComplete, cachedProfile }) => {
    const { firstLanguage: savedFirstLanguage } = useFirstLanguage();
    const [step, setStep] = useState(0);
    const [profile, setProfile] = useState<Partial<SpeakingProfileData>>(cachedProfile || {
        targetLanguage: 'en',
        firstLanguage: savedFirstLanguage || 'en',
        speakingLevel: 2,
        contextPreferences: [],
        speakingComfort: 'moderate',
        difficulties: [],
        goals: [],
        interests: '',
    });

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
        const completedProfile: SpeakingProfileData = {
            targetLanguage: profile.targetLanguage!,
            firstLanguage: profile.firstLanguage!,
            speakingLevel: profile.speakingLevel!,
            contextPreferences: profile.contextPreferences!,
            speakingComfort: profile.speakingComfort!,
            difficulties: profile.difficulties!,
            goals: profile.goals!,
            interests: profile.interests!,
            completedAt: Date.now(),
        };
        onComplete(completedProfile);
    };

    const toggleArrayItem = (key: keyof SpeakingProfileData, value: string) => {
        const current = (profile[key] as string[]) || [];
        setProfile({
            ...profile,
            [key]: current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value]
        });
    };

    const canProceed = () => {
        switch (step) {
            case 0: return !!profile.targetLanguage;
            case 1: return !!profile.firstLanguage;
            case 2: return profile.speakingLevel !== undefined;
            case 3: return (profile.contextPreferences?.length || 0) > 0;
            case 4: return !!profile.speakingComfort;
            case 5: return (profile.difficulties?.length || 0) > 0;
            case 6: return true;
            default: return false;
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Mic className="w-5 h-5 text-green-600" />
                        Speaking Profile
                    </h2>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Step {step + 1} of {totalSteps}
                    </div>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-600 transition-all duration-300"
                        style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-2xl mx-auto">
                    {/* Step 0: Target Language */}
                    {step === 0 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-6 h-6 text-green-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        What language are you learning to speak?
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Select the target language you want to improve your speaking skills in.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {languages.map(lang => (
                                    <button
                                        key={lang.id}
                                        onClick={() => setProfile({ ...profile, targetLanguage: lang.id })}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.targetLanguage === lang.id
                                                ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{lang.flag}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{lang.label}</span>
                                            {profile.targetLanguage === lang.id && (
                                                <Check className="w-5 h-5 text-green-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 1: First Language */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-6 h-6 text-green-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        What is your first language?
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    We'll generate translation prompts in this language for you to translate orally.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {languages.map(lang => (
                                    <button
                                        key={lang.id}
                                        onClick={() => setProfile({ ...profile, firstLanguage: lang.id })}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.firstLanguage === lang.id
                                                ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{lang.flag}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{lang.label}</span>
                                            {profile.firstLanguage === lang.id && (
                                                <Check className="w-5 h-5 text-green-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Speaking Level */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Gauge className="w-6 h-6 text-green-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Current Speaking Level
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    How would you rate your current speaking ability?
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <div className="text-sm font-medium text-green-900 dark:text-green-100">
                                        Level {(profile.speakingLevel || 0) + 1}: {speakingLevelDescriptions[profile.speakingLevel || 0]}
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="4"
                                    value={profile.speakingLevel || 0}
                                    onChange={(e) => setProfile({ ...profile, speakingLevel: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="space-y-2 mt-6">
                                    {speakingLevelDescriptions.map((desc, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-lg text-sm ${
                                                profile.speakingLevel === idx
                                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100 border border-green-200 dark:border-green-800'
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

                    {/* Step 3: Context Preferences */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Mic className="w-6 h-6 text-green-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Conversation Contexts
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    What situations do you want to practice speaking in? (Select all that apply)
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {contextPreferences.map(ctx => (
                                    <button
                                        key={ctx.id}
                                        onClick={() => toggleArrayItem('contextPreferences', ctx.id)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.contextPreferences?.includes(ctx.id)
                                                ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{ctx.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">{ctx.label}</span>
                                            {profile.contextPreferences?.includes(ctx.id) && (
                                                <Check className="w-5 h-5 text-green-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Speaking Comfort */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Gauge className="w-6 h-6 text-green-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Speaking Comfort Level
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    How comfortable are you when speaking?
                                </p>
                            </div>
                            <div className="space-y-3">
                                {speakingComfortOptions.map(comfort => (
                                    <button
                                        key={comfort.id}
                                        onClick={() => setProfile({ ...profile, speakingComfort: comfort.id })}
                                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                                            profile.speakingComfort === comfort.id
                                                ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{comfort.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{comfort.label}</span>
                                            {profile.speakingComfort === comfort.id && (
                                                <Check className="w-5 h-5 text-green-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Difficulties */}
                    {step === 5 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-6 h-6 text-green-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Main Speaking Difficulties
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    What challenges do you face when speaking? (Select all that apply)
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {speakingDifficulties.map(diff => (
                                    <button
                                        key={diff.id}
                                        onClick={() => toggleArrayItem('difficulties', diff.id)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.difficulties?.includes(diff.id)
                                                ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{diff.icon}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">{diff.label}</span>
                                            {profile.difficulties?.includes(diff.id) && (
                                                <Check className="w-5 h-5 text-green-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 6: Specific Interests */}
                    {step === 6 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-6 h-6 text-green-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Specific Interests
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Tell us more about your specific speaking interests (Optional).
                                    This helps us generate personalized speaking prompts.
                                </p>
                            </div>
                            <textarea
                                value={profile.interests || ''}
                                onChange={(e) => setProfile({ ...profile, interests: e.target.value })}
                                placeholder="e.g., Ordering food at restaurants, negotiating prices at markets, presenting at work..."
                                className="w-full h-32 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none"
                            />
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                <p className="text-sm text-green-900 dark:text-green-100">
                                    <strong>Tip:</strong> The more specific you are, the better we can tailor speaking prompts to your needs!
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer navigation */}
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
                            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleComplete}
                            disabled={!canProceed()}
                            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

export default SpeakingProfile;
