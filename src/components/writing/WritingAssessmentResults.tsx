import React, { useState } from 'react';
import {
    PenTool,
    ChevronDown,
    ChevronUp,
    Globe,
    Gauge,
    Target,
    AlertTriangle,
    Sparkles,
    RotateCcw,
    Play,
} from 'lucide-react';
import { WritingProfileData } from './WritingProfile';
import { WritingTestResponse } from '../../hooks/useWritingTest';
import { TranslationPrompt, WritingAnalysis } from '../../services/geminiService';
import WritingTestAnalysis from './WritingTestAnalysis';
import {
    getLanguageLabel,
    getWritingLevelLabel,
    getWritingPurposeLabel,
    getDifficultyLabel,
    getGoalLabel,
} from './writingProfileData';

interface WritingAssessmentResultsProps {
    profile: WritingProfileData;
    prompts: TranslationPrompt[];
    responses: WritingTestResponse[];
    cachedAnalysis?: WritingAnalysis;
    onRetakeAssessment: () => void;
    onRetakeMiniTest: () => void;
}

const WritingAssessmentResults: React.FC<WritingAssessmentResultsProps> = ({
    profile,
    prompts,
    responses,
    cachedAnalysis,
    onRetakeAssessment,
    onRetakeMiniTest,
}) => {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    const toggleSection = (section: string) => {
        const next = new Set(expandedSections);
        if (next.has(section)) {
            next.delete(section);
        } else {
            next.add(section);
        }
        setExpandedSections(next);
    };

    const isExpanded = (section: string) => expandedSections.has(section);

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PenTool className="w-6 h-6 text-purple-600" />
                        Writing Assessment Results
                    </h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onRetakeAssessment}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Retake
                        </button>
                        <button
                            onClick={onRetakeMiniTest}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            <Play className="w-4 h-4" />
                            Take Test
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => toggleSection('partA')}
                            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 border-b border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                                    A
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Writing Profile</h3>
                            </div>
                            {isExpanded('partA') ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                        </button>

                        {isExpanded('partA') && (
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Globe className="w-5 h-5 text-purple-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Target Language</span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {getLanguageLabel(profile.targetLanguage)}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Globe className="w-5 h-5 text-blue-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">First Language</span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {getLanguageLabel(profile.firstLanguage)}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Gauge className="w-5 h-5 text-purple-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Writing Level</span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white">Level {profile.writingLevel + 1}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{getWritingLevelLabel(profile.writingLevel)}</p>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <PenTool className="w-5 h-5 text-purple-600" />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Writing Purposes</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.writingPurposes.map(purpose => (
                                            <span
                                                key={purpose}
                                                className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium"
                                            >
                                                {getWritingPurposeLabel(purpose)}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Main Difficulties</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.difficulties.map(diff => (
                                            <span
                                                key={diff}
                                                className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded-full text-sm font-medium"
                                            >
                                                {getDifficultyLabel(diff)}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Target className="w-5 h-5 text-green-600" />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Writing Goals</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.goals.map(goal => (
                                            <span
                                                key={goal}
                                                className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium"
                                            >
                                                {getGoalLabel(goal)}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {profile.interests && (
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className="w-5 h-5 text-yellow-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Specific Interests</span>
                                        </div>
                                        <p className="text-gray-900 dark:text-white">{profile.interests}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => toggleSection('partB')}
                            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                                    B
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mini-Test Results</h3>
                            </div>
                            {isExpanded('partB') ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                        </button>

                        {isExpanded('partB') && (
                            <div className="p-6">
                                {responses.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                            <PenTool className="w-8 h-8 text-purple-500" />
                                        </div>
                                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Test Results Yet</h4>
                                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                                            Take the mini-test to get detailed writing feedback.
                                        </p>
                                        <button
                                            onClick={onRetakeMiniTest}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                        >
                                            <Play className="w-4 h-4" />
                                            Take Mini-Test
                                        </button>
                                    </div>
                                ) : (
                                    <WritingTestAnalysis
                                        profile={profile}
                                        prompts={prompts}
                                        responses={responses}
                                        cachedAnalysis={cachedAnalysis}
                                        variant="embedded"
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            onClick={onRetakeAssessment}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <RotateCcw className="w-5 h-5" />
                            Retake Assessment
                        </button>
                        <button
                            onClick={onRetakeMiniTest}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-fuchsia-600 transition-all"
                        >
                            <Play className="w-5 h-5" />
                            Retake Mini-Test
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WritingAssessmentResults;
