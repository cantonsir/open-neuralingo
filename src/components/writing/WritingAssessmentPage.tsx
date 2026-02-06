import React, { useEffect, useState } from 'react';
import WritingProfile, { WritingProfileData } from './WritingProfile';
import WritingMiniTest from './WritingMiniTest';
import WritingAssessmentResults from './WritingAssessmentResults';
import { WritingTestResponse } from '../../hooks/useWritingTest';
import { TranslationPrompt, WritingAnalysis } from '../../services/geminiService';

export default function WritingAssessmentPage() {
    const [hasProfile, setHasProfile] = useState<boolean>(false);
    const [profile, setProfile] = useState<WritingProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTakingTest, setIsTakingTest] = useState(false);
    const [testResponses, setTestResponses] = useState<WritingTestResponse[]>([]);
    const [testPrompts, setTestPrompts] = useState<TranslationPrompt[]>([]);
    const [cachedAnalysis, setCachedAnalysis] = useState<WritingAnalysis | null>(null);

    useEffect(() => {
        const loadProfileAndAssessment = async () => {
            const savedState = localStorage.getItem('writingAssessmentState');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    if (state.testResponses && state.testPrompts && state.testResponses.length > 0) {
                        setProfile(state.profile);
                        setHasProfile(true);
                        setTestResponses(state.testResponses);
                        setTestPrompts(state.testPrompts);
                        setCachedAnalysis(state.analysis || null);
                        setLoading(false);
                        return;
                    }
                } catch (err) {
                    console.error('Error restoring writing assessment state:', err);
                    localStorage.removeItem('writingAssessmentState');
                }
            }

            try {
                const profileRes = await fetch('/api/writing/profile');
                const profileData = await profileRes.json();

                if (profileData && profileData.id) {
                    setProfile(profileData);
                    setHasProfile(true);

                    try {
                        const assessmentsRes = await fetch('/api/writing/assessments');
                        const assessmentsData = await assessmentsRes.json();

                        if (assessmentsData && assessmentsData.length > 0) {
                            const latestAssessment = assessmentsData[0];
                            const detailsRes = await fetch(`/api/writing/assessment/${latestAssessment.id}`);
                            const detailsData = await detailsRes.json();

                            if (detailsData && detailsData.prompts && detailsData.responses) {
                                setTestPrompts(detailsData.prompts);
                                setTestResponses(detailsData.responses);
                                setCachedAnalysis(detailsData.analysis || null);
                            }
                        }
                    } catch (assessmentErr) {
                        console.error('Error loading writing assessments:', assessmentErr);
                    }
                }
                setLoading(false);
            } catch (err) {
                console.error('Error loading writing profile:', err);
                setLoading(false);
            }
        };

        loadProfileAndAssessment();
    }, []);

    const handleProfileComplete = async (profileData: WritingProfileData) => {
        try {
            const response = await fetch('/api/writing/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData),
            });

            const result = await response.json();

            if (result.status === 'success') {
                const profileWithId = { ...profileData, id: result.id };
                setProfile(profileWithId);
                setHasProfile(true);
            }
        } catch (error) {
            console.error('Error saving writing profile:', error);
            setProfile(profileData);
            setHasProfile(true);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-600 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    if (!hasProfile) {
        return <WritingProfile onComplete={handleProfileComplete} cachedProfile={profile} />;
    }

    const handleTestComplete = async (responses: WritingTestResponse[], prompts: TranslationPrompt[]) => {
        setTestResponses(responses);
        setTestPrompts(prompts);
        setIsTakingTest(false);
        setCachedAnalysis(null);

        const stateToSave = {
            profile,
            testResponses: responses,
            testPrompts: prompts,
            analysis: null,
        };
        localStorage.setItem('writingAssessmentState', JSON.stringify(stateToSave));
    };

    if (!profile) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
            </div>
        );
    }

    if (isTakingTest) {
        return (
            <WritingMiniTest
                profile={profile}
                onComplete={handleTestComplete}
                onBack={() => setIsTakingTest(false)}
            />
        );
    }

    return (
        <WritingAssessmentResults
            profile={profile}
            prompts={testPrompts}
            responses={testResponses}
            cachedAnalysis={cachedAnalysis || undefined}
            onRetakeAssessment={() => {
                localStorage.removeItem('writingAssessmentState');
                setTestResponses([]);
                setTestPrompts([]);
                setCachedAnalysis(null);
                setHasProfile(false);
            }}
            onRetakeMiniTest={() => {
                localStorage.removeItem('writingAssessmentState');
                setTestResponses([]);
                setTestPrompts([]);
                setCachedAnalysis(null);
                setIsTakingTest(true);
            }}
        />
    );
}
