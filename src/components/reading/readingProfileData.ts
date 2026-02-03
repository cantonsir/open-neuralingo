/**
 * Shared reading profile data - labels, options, and descriptions
 * Used by both ReadingProfile form and ReadingAssessmentResults display
 */

export const languages = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'ja', label: 'Japanese', flag: '🇯🇵' },
    { id: 'zh-HK', label: 'Cantonese (Traditional)', flag: '🇭🇰' },
    { id: 'zh-CN', label: 'Mandarin (Simplified)', flag: '🇨🇳' },
    { id: 'de', label: 'German', flag: '🇩🇪' },
    { id: 'fr', label: 'French', flag: '🇫🇷' },
    { id: 'es', label: 'Spanish', flag: '🇪🇸' },
];

export const readingLevelDescriptions = [
    'Beginner - Simple sentences, basic vocabulary',
    'Elementary - Short paragraphs, common topics',
    'Intermediate - Longer texts, varied topics',
    'Advanced - Complex texts, technical content',
    'Native-like - Literature, specialized domains',
];

export const contentPreferences = [
    { id: 'fiction', label: 'Fiction & Stories', emoji: '📖' },
    { id: 'news', label: 'News & Current Events', emoji: '📰' },
    { id: 'academic', label: 'Academic & Research', emoji: '🎓' },
    { id: 'technical', label: 'Technical & Professional', emoji: '💻' },
    { id: 'lifestyle', label: 'Lifestyle & Culture', emoji: '🌟' },
    { id: 'business', label: 'Business & Finance', emoji: '💼' },
    { id: 'science', label: 'Science & Technology', emoji: '🔬' },
    { id: 'other', label: 'Other', emoji: '📚' },
];

export const readingSpeedOptions = [
    { id: 'fast', label: 'Fast reader (skim & scan)', emoji: '⚡' },
    { id: 'moderate', label: 'Moderate pace (balanced)', emoji: '👍' },
    { id: 'slow', label: 'Slow & careful (detail-oriented)', emoji: '🔍' },
];

export const difficulties = [
    { id: 'vocabulary', label: 'Vocabulary (unknown words)', icon: '📚' },
    { id: 'grammar', label: 'Grammar structures', icon: '🔧' },
    { id: 'idioms', label: 'Idioms & expressions', icon: '💬' },
    { id: 'cultural', label: 'Cultural references', icon: '🌍' },
    { id: 'complex-sentences', label: 'Long/complex sentences', icon: '📝' },
    { id: 'technical', label: 'Technical terminology', icon: '⚙️' },
    { id: 'abstract', label: 'Abstract concepts', icon: '🤔' },
];

export const readingGoals = [
    { id: 'entertainment', label: 'Entertainment & enjoyment', emoji: '🎭' },
    { id: 'academic', label: 'Academic study', emoji: '🎓' },
    { id: 'professional', label: 'Professional work', emoji: '💼' },
    { id: 'language-learning', label: 'Language learning', emoji: '🗣️' },
    { id: 'cultural', label: 'Cultural understanding', emoji: '🌏' },
    { id: 'exam', label: 'Exam preparation', emoji: '📋' },
];

// Helper functions to get labels by ID
export const getLanguageLabel = (id: string): string => {
    const lang = languages.find(l => l.id === id);
    return lang ? `${lang.flag} ${lang.label}` : id;
};

export const getLanguageFlag = (id: string): string => {
    const lang = languages.find(l => l.id === id);
    return lang?.flag || '';
};

export const getReadingLevelLabel = (level: number): string => {
    return readingLevelDescriptions[level] || `Level ${level + 1}`;
};

export const getContentPreferenceLabel = (id: string): string => {
    const pref = contentPreferences.find(c => c.id === id);
    return pref ? `${pref.emoji} ${pref.label}` : id;
};

export const getReadingSpeedLabel = (id: string): string => {
    const speed = readingSpeedOptions.find(s => s.id === id);
    return speed ? `${speed.emoji} ${speed.label}` : id;
};

export const getDifficultyLabel = (id: string): string => {
    const diff = difficulties.find(d => d.id === id);
    return diff ? `${diff.icon} ${diff.label}` : id;
};

export const getGoalLabel = (id: string): string => {
    const goal = readingGoals.find(g => g.id === id);
    return goal ? `${goal.emoji} ${goal.label}` : id;
};
