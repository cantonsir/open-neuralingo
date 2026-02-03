import React, { useState } from 'react';
import {
    ChevronRight,
    ChevronLeft,
    Check,
    Globe,
    BookOpen,
    Gauge,
    Target,
    AlertTriangle,
    Sparkles
} from 'lucide-react';

export interface ReadingProfileData {
    id?: string;
    targetLanguage: string;
    readingLevel: number;
    contentPreferences: string[];
    readingSpeed: string;
    difficulties: string[];
    goals: string[];
    interests: string;
    completedAt: number;
}

interface ReadingProfileProps {
    onComplete: (profile: ReadingProfileData) => void;
    cachedProfile?: ReadingProfileData | null;
}

// Question data
const languages = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'ja', label: 'Japanese', flag: '🇯🇵' },
    { id: 'zh-HK', label: 'Cantonese (Traditional)', flag: '🇭🇰' },
    { id: 'zh-CN', label: 'Mandarin (Simplified)', flag: '🇨🇳' },
    { id: 'de', label: 'German', flag: '🇩🇪' },
    { id: 'fr', label: 'French', flag: '🇫🇷' },
    { id: 'es', label: 'Spanish', flag: '🇪🇸' },
];

const readingLevelDescriptions = [
    'Beginner - Simple sentences, basic vocabulary',
    'Elementary - Short paragraphs, common topics',
    'Intermediate - Longer texts, varied topics',
    'Advanced - Complex texts, technical content',
    'Native-like - Literature, specialized domains',
];

const contentPreferences = [
    { id: 'fiction', label: 'Fiction & Stories', emoji: '📖' },
    { id: 'news', label: 'News & Current Events', emoji: '📰' },
    { id: 'academic', label: 'Academic & Research', emoji: '🎓' },
    { id: 'technical', label: 'Technical & Professional', emoji: '💻' },
    { id: 'lifestyle', label: 'Lifestyle & Culture', emoji: '🌟' },
    { id: 'business', label: 'Business & Finance', emoji: '💼' },
    { id: 'science', label: 'Science & Technology', emoji: '🔬' },
    { id: 'other', label: 'Other', emoji: '📚' },
];

const readingSpeedOptions = [
    { id: 'fast', label: 'Fast reader (skim & scan)', emoji: '⚡' },
    { id: 'moderate', label: 'Moderate pace (balanced)', emoji: '👍' },
    { id: 'slow', label: 'Slow & careful (detail-oriented)', emoji: '🔍' },
];

const difficulties = [
    { id: 'vocabulary', label: 'Vocabulary (unknown words)', icon: '📚' },
    { id: 'grammar', label: 'Grammar structures', icon: '🔧' },
    { id: 'idioms', label: 'Idioms & expressions', icon: '💬' },
    { id: 'cultural', label: 'Cultural references', icon: '🌍' },
    { id: 'complex-sentences', label: 'Long/complex sentences', icon: '📝' },
    { id: 'technical', label: 'Technical terminology', icon: '⚙️' },
    { id: 'abstract', label: 'Abstract concepts', icon: '🤔' },
];

const readingGoals = [
    { id: 'entertainment', label: 'Entertainment & enjoyment', emoji: '🎭' },
    { id: 'academic', label: 'Academic study', emoji: '🎓' },
    { id: 'professional', label: 'Professional work', emoji: '💼' },
    { id: 'language-learning', label: 'Language learning', emoji: '🗣️' },
    { id: 'cultural', label: 'Cultural understanding', emoji: '🌏' },
    { id: 'exam', label: 'Exam preparation', emoji: '📋' },
];

const ReadingProfile: React.FC<ReadingProfileProps> = ({ onComplete, cachedProfile }) => {
    const [step, setStep] = useState(0);
    const [profile, setProfile] = useState<Partial<ReadingProfileData>>(cachedProfile || {
        targetLanguage: 'en',
        readingLevel: 2,
        contentPreferences: [],
        readingSpeed: 'moderate',
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
        const completedProfile: ReadingProfileData = {
            targetLanguage: profile.targetLanguage!,
            readingLevel: profile.readingLevel!,
            contentPreferences: profile.contentPreferences!,
            readingSpeed: profile.readingSpeed!,
            difficulties: profile.difficulties!,
            goals: profile.goals!,
            interests: profile.interests!,
            completedAt: Date.now(),
        };
        onComplete(completedProfile);
    };

    const toggleArrayItem = (key: keyof ReadingProfileData, value: string) => {
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
            case 1: return profile.readingLevel !== undefined;
            case 2: return (profile.contentPreferences?.length || 0) > 0;
            case 3: return !!profile.readingSpeed;
            case 4: return (profile.difficulties?.length || 0) > 0;
            case 5: return (profile.goals?.length || 0) > 0;
            case 6: return true; // Interests is optional
            default: return false;
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        Reading Profile
                    </h2>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Step {step + 1} of {totalSteps}
                    </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300"
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
                                    <Globe className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        What language are you reading in?
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Select the target language you want to improve your reading skills in.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {languages.map(lang => (
                                    <button
                                        key={lang.id}
                                        onClick={() => setProfile({ ...profile, targetLanguage: lang.id })}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.targetLanguage === lang.id
                                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{lang.flag}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {lang.label}
                                            </span>
                                            {profile.targetLanguage === lang.id && (
                                                <Check className="w-5 h-5 text-blue-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 1: Reading Level */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Gauge className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Current Reading Level
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    How would you rate your current reading level?
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                        Level {(profile.readingLevel || 0) + 1}: {readingLevelDescriptions[profile.readingLevel || 0]}
                                    </div>
                                </div>

                                <input
                                    type="range"
                                    min="0"
                                    max="4"
                                    value={profile.readingLevel || 0}
                                    onChange={(e) => setProfile({ ...profile, readingLevel: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />

                                <div className="space-y-2 mt-6">
                                    {readingLevelDescriptions.map((desc, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-lg text-sm ${
                                                profile.readingLevel === idx
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800'
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

                    {/* Step 2: Content Preferences */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <BookOpen className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Content Preferences
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    What types of content do you enjoy reading? (Select all that apply)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {contentPreferences.map(content => (
                                    <button
                                        key={content.id}
                                        onClick={() => toggleArrayItem('contentPreferences', content.id)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.contentPreferences?.includes(content.id)
                                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{content.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                {content.label}
                                            </span>
                                            {profile.contentPreferences?.includes(content.id) && (
                                                <Check className="w-5 h-5 text-blue-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Reading Speed */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Gauge className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Reading Speed Preference
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    How do you typically read?
                                </p>
                            </div>

                            <div className="space-y-3">
                                {readingSpeedOptions.map(speed => (
                                    <button
                                        key={speed.id}
                                        onClick={() => setProfile({ ...profile, readingSpeed: speed.id })}
                                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                                            profile.readingSpeed === speed.id
                                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{speed.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {speed.label}
                                            </span>
                                            {profile.readingSpeed === speed.id && (
                                                <Check className="w-5 h-5 text-blue-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Main Difficulties */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Main Reading Difficulties
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    What challenges do you face when reading? (Select all that apply)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {difficulties.map(diff => (
                                    <button
                                        key={diff.id}
                                        onClick={() => toggleArrayItem('difficulties', diff.id)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.difficulties?.includes(diff.id)
                                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{diff.icon}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                {diff.label}
                                            </span>
                                            {profile.difficulties?.includes(diff.id) && (
                                                <Check className="w-5 h-5 text-blue-600 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Reading Goals */}
                    {step === 5 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Target className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Reading Goals
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Why do you want to improve your reading skills? (Select all that apply)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {readingGoals.map(goal => (
                                    <button
                                        key={goal.id}
                                        onClick={() => toggleArrayItem('goals', goal.id)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            profile.goals?.includes(goal.id)
                                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{goal.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                {goal.label}
                                            </span>
                                            {profile.goals?.includes(goal.id) && (
                                                <Check className="w-5 h-5 text-blue-600 ml-auto" />
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
                                    <Sparkles className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Specific Interests
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Tell us more about your specific reading interests (Optional).
                                    This helps us generate personalized reading passages.
                                </p>
                            </div>

                            <textarea
                                value={profile.interests || ''}
                                onChange={(e) => setProfile({ ...profile, interests: e.target.value })}
                                placeholder="e.g., Science fiction novels, medical research papers, business strategy articles..."
                                className="w-full h-32 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                            />

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-sm text-blue-900 dark:text-blue-100">
                                    <strong>Tip:</strong> The more specific you are, the better we can tailor reading passages to your interests!
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
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

export default ReadingProfile;
