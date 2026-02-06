/**
 * Shared writing profile data - labels, options, and descriptions
 * Used by both WritingProfile form and WritingAssessmentResults display
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

export const writingLevelDescriptions = [
    'Beginner - Simple words and phrases',
    'Elementary - Basic sentences with common vocabulary',
    'Intermediate - Connected sentences, varied vocabulary',
    'Advanced - Complex structures, nuanced expression',
    'Native-like - Sophisticated style, idiomatic usage',
];

export const writingPurposes = [
    { id: 'email', label: 'Emails & Messages', emoji: '📧' },
    { id: 'essays', label: 'Essays & Articles', emoji: '📝' },
    { id: 'creative', label: 'Creative Writing', emoji: '✨' },
    { id: 'academic', label: 'Academic Papers', emoji: '🎓' },
    { id: 'business', label: 'Business Documents', emoji: '💼' },
    { id: 'social', label: 'Social Media Posts', emoji: '📱' },
    { id: 'journal', label: 'Personal Journal', emoji: '📓' },
    { id: 'other', label: 'Other', emoji: '📄' },
];

export const writingDifficulties = [
    { id: 'grammar', label: 'Grammar rules', icon: '🔧' },
    { id: 'vocabulary', label: 'Limited vocabulary', icon: '📚' },
    { id: 'sentence-structure', label: 'Sentence structure', icon: '📐' },
    { id: 'word-order', label: 'Word order', icon: '🔀' },
    { id: 'tenses', label: 'Verb tenses', icon: '⏰' },
    { id: 'articles', label: 'Articles & prepositions', icon: '📌' },
    { id: 'formality', label: 'Formal/informal register', icon: '👔' },
    { id: 'spelling', label: 'Spelling & punctuation', icon: '✏️' },
];

export const writingGoals = [
    { id: 'accuracy', label: 'Grammar accuracy', emoji: '🎯' },
    { id: 'fluency', label: 'Writing fluency', emoji: '🌊' },
    { id: 'vocabulary', label: 'Expand vocabulary', emoji: '📖' },
    { id: 'style', label: 'Improve style', emoji: '🎨' },
    { id: 'speed', label: 'Write faster', emoji: '⚡' },
    { id: 'exam', label: 'Exam preparation', emoji: '📋' },
];

export const writingSpeedOptions = [
    { id: 'fast', label: 'Fast writer (quick drafts)', emoji: '⚡' },
    { id: 'moderate', label: 'Moderate pace (balanced)', emoji: '👍' },
    { id: 'slow', label: 'Slow & careful (detail-oriented)', emoji: '🔍' },
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

export const getWritingLevelLabel = (level: number): string => {
    return writingLevelDescriptions[level] || `Level ${level + 1}`;
};

export const getWritingPurposeLabel = (id: string): string => {
    const purpose = writingPurposes.find(p => p.id === id);
    return purpose ? `${purpose.emoji} ${purpose.label}` : id;
};

export const getWritingSpeedLabel = (id: string): string => {
    const speed = writingSpeedOptions.find(s => s.id === id);
    return speed ? `${speed.emoji} ${speed.label}` : id;
};

export const getDifficultyLabel = (id: string): string => {
    const diff = writingDifficulties.find(d => d.id === id);
    return diff ? `${diff.icon} ${diff.label}` : id;
};

export const getGoalLabel = (id: string): string => {
    const goal = writingGoals.find(g => g.id === id);
    return goal ? `${goal.emoji} ${goal.label}` : id;
};
