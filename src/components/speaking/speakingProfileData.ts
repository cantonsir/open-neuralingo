/**
 * Shared speaking profile data - labels, options, and descriptions
 * Used by both SpeakingProfile form and SpeakingAssessmentResults display
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

export const speakingLevelDescriptions = [
    'Beginner - Basic phrases and greetings only',
    'Elementary - Simple sentences, limited topics',
    'Intermediate - Conversational, some hesitation',
    'Advanced - Fluent, complex discussions',
    'Native-like - Near-native fluency and idioms',
];

export const contextPreferences = [
    { id: 'casual', label: 'Casual Conversation', emoji: '💬' },
    { id: 'business', label: 'Business & Professional', emoji: '💼' },
    { id: 'travel', label: 'Travel & Tourism', emoji: '✈️' },
    { id: 'academic', label: 'Academic & Education', emoji: '🎓' },
    { id: 'medical', label: 'Medical & Health', emoji: '🏥' },
    { id: 'daily', label: 'Daily Life & Errands', emoji: '🛒' },
    { id: 'social', label: 'Social Events', emoji: '🎉' },
    { id: 'technical', label: 'Technical & IT', emoji: '💻' },
];

export const speakingComfortOptions = [
    { id: 'very_slow', label: 'Very slow and careful', emoji: '🐢' },
    { id: 'slow', label: 'Slow with pauses', emoji: '🔍' },
    { id: 'moderate', label: 'Moderate conversational pace', emoji: '👍' },
    { id: 'fast', label: 'Fast and natural', emoji: '⚡' },
    { id: 'native', label: 'Native speed with slang', emoji: '🚀' },
];

export const speakingDifficulties = [
    { id: 'pronunciation', label: 'Pronunciation & accent', icon: '🗣️' },
    { id: 'grammar', label: 'Grammar in speech', icon: '🔧' },
    { id: 'vocabulary', label: 'Limited vocabulary', icon: '📚' },
    { id: 'fluency', label: 'Fluency & hesitation', icon: '⏸️' },
    { id: 'intonation', label: 'Intonation & rhythm', icon: '🎵' },
    { id: 'word-order', label: 'Word order mistakes', icon: '🔀' },
    { id: 'listening', label: 'Understanding responses', icon: '👂' },
];

export const speakingGoals = [
    { id: 'travel', label: 'Travel communication', emoji: '🌍' },
    { id: 'work', label: 'Professional work', emoji: '💼' },
    { id: 'daily', label: 'Daily life conversations', emoji: '🏠' },
    { id: 'exam', label: 'Exam preparation', emoji: '📋' },
    { id: 'social', label: 'Making friends abroad', emoji: '🤝' },
    { id: 'professional', label: 'Presentations & meetings', emoji: '📊' },
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

export const getSpeakingLevelLabel = (level: number): string => {
    return speakingLevelDescriptions[level] || `Level ${level + 1}`;
};

export const getContextLabel = (id: string): string => {
    const ctx = contextPreferences.find(c => c.id === id);
    return ctx ? `${ctx.emoji} ${ctx.label}` : id;
};

export const getComfortLabel = (id: string): string => {
    const comfort = speakingComfortOptions.find(s => s.id === id);
    return comfort ? `${comfort.emoji} ${comfort.label}` : id;
};

export const getDifficultyLabel = (id: string): string => {
    const diff = speakingDifficulties.find(d => d.id === id);
    return diff ? `${diff.icon} ${diff.label}` : id;
};

export const getGoalLabel = (id: string): string => {
    const goal = speakingGoals.find(g => g.id === id);
    return goal ? `${goal.emoji} ${goal.label}` : id;
};
