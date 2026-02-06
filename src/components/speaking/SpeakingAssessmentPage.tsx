import React, { useState, useEffect } from 'react';
import SpeakingProfile, { SpeakingProfileData } from './SpeakingProfile';
import SpeakingMiniTest from './SpeakingMiniTest';
import SpeakingAssessmentResults from './SpeakingAssessmentResults';
import { SpeakingTestResponse } from '../../hooks/useSpeakingTest';
import { TranslationPrompt, SpeakingAnalysis } from '../../services/geminiService';

export default function SpeakingAssessmentPage() {
    const [hasProfile, setHasProfile] = useState<boolean>(false);
    const [profile, setProfile] = useState<SpeakingProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTakingTest, setIsTakingTest] = useState(false);
    const [testResponse, setTestResponse] = useState<SpeakingTestResponse | null>(null);
    const [testPrompts, setTestPrompts] = useState<TranslationPrompt[]>([]);
    const [cachedAnalysis, setCachedAnalysis] = useState<SpeakingAnalysis | null>(null);

    useEffect(() => {
        const loadProfileAndAssessment = async () => {
            // Try to restore state from localStorage first
            const savedState = localStorage.getItem('speakingAssessmentState');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    if (state.testResponse && state.testPrompts && state.testResponse.translationResponses.length > 0) {
                        // Restore completed test state
                        setProfile(state.profile);
                        setHasProfile(true);
                        setTestResponse(state.testResponse);
                        setTestPrompts(state.testPrompts);
                        setCachedAnalysis(state.analysis || null);
                        setLoading(false);
                        return;
                    }
                } catch (err) {
                    console.error('Error restoring state:', err);
                    localStorage.removeItem('speakingAssessmentState');
                }
            }

            // Check if profile exists
            try {
                const profileRes = await fetch('/api/speaking/profile');
                const profileData = await profileRes.json();

                if (profileData && profileData.id) {
                    setProfile(profileData);
                    setHasProfile(true);

                    // Try to fetch the latest assessment from backend
                    try {
                        const assessmentsRes = await fetch('/api/speaking/assessments');
                        const assessmentsData = await assessmentsRes.json();

                        if (assessmentsData && assessmentsData.length > 0) {
                            // Get the most recent assessment
                            const latestAssessment = assessmentsData[0];

                            // Fetch full assessment details
                            const detailsRes = await fetch(`/api/speaking/assessment/${latestAssessment.id}`);
                            const details = await detailsRes.json();

                            if (details && details.prompts && details.responses) {
                                // Reconstruct test response
                                const testResp: SpeakingTestResponse = {
                                    translationResponses: details.responses,
                                    conversationTranscript: details.conversationTranscript || [],
                                    totalTestTimeMs: 0,
                                };

                                setTestResponse(testResp);
                                setTestPrompts(details.prompts);
                                setCachedAnalysis(details.analysis || null);
                            }
                        }
                    } catch (assessmentErr) {
                        console.error('Error loading assessments:', assessmentErr);
                    }
                }
                setLoading(false);
            } catch (err) {
                console.error('Error loading speaking profile:', err);
                setLoading(false);
            }
        };

        loadProfileAndAssessment();
    }, []);

    const handleProfileComplete = async (profileData: SpeakingProfileData) => {
        try {
            // Save profile to backend
            const response = await fetch('/api/speaking/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Add the profile id from backend
                const profileWithId = { ...profileData, id: result.id };
                setProfile(profileWithId);
                setHasProfile(true);
            }
        } catch (error) {
            console.error('Error saving speaking profile:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-600 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    // No profile yet - show questionnaire
    if (!hasProfile) {
        return (
            <SpeakingProfile
                onComplete={handleProfileComplete}
                cachedProfile={profile}
            />
        );
    }

    // Handle test completion
    const handleTestComplete = async (response: SpeakingTestResponse, prompts: TranslationPrompt[]) => {
        console.log('Speaking test completed!', response);

        // Store test results and prompts
        setTestResponse(response);
        setTestPrompts(prompts);
        setIsTakingTest(false); // Return to results view
        setCachedAnalysis(null);

        // Save state to localStorage so we can restore it when navigating back
        const stateToSave = {
            profile,
            testResponse: response,
            testPrompts: prompts,
            analysis: null,
        };
        localStorage.setItem('speakingAssessmentState', JSON.stringify(stateToSave));
    };

    // Safety check for profile
    if (!profile) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
            </div>
        );
    }

    // User clicked "Take Test" - show the mini-test
    if (isTakingTest) {
        return (
            <SpeakingMiniTest
                profile={profile}
                onComplete={handleTestComplete}
                onBack={() => setIsTakingTest(false)} // Go back to results view
            />
        );
    }

    // Profile exists - always show results page first
    // (Results page shows "Take Mini-Test" button if no test results yet)
    return (
        <SpeakingAssessmentResults
            profile={profile}
            prompts={testPrompts}
            testResponse={testResponse}
            cachedAnalysis={cachedAnalysis || undefined}
            onRetakeAssessment={() => {
                // Reset to questionnaire - user wants to redo the profile
                localStorage.removeItem('speakingAssessmentState');
                setTestResponse(null);
                setTestPrompts([]);
                setCachedAnalysis(null);
                setHasProfile(false); // Go back to profile questionnaire
            }}
            onRetakeMiniTest={() => {
                // Start (or retake) the mini-test
                localStorage.removeItem('speakingAssessmentState');
                setTestResponse(null);
                setTestPrompts([]);
                setCachedAnalysis(null);
                setIsTakingTest(true); // Go to mini-test
            }}
        />
    );
}
