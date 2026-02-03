import React, { useState, useEffect } from 'react';
import ReadingProfile, { ReadingProfileData } from './ReadingProfile';
import ReadingMiniTest from './ReadingMiniTest';
import ReadingAssessmentResults from './ReadingAssessmentResults';
import { ReadingTestResponse } from '../../hooks/useReadingTest';
import { GeneratedPassage, ReadingAnalysis } from '../../services/geminiService';
import { api } from '../../db';

export default function ReadingAssessmentPage() {
    const [hasProfile, setHasProfile] = useState<boolean>(false);
    const [profile, setProfile] = useState<ReadingProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTakingTest, setIsTakingTest] = useState(false); // Track if user is actively taking the test
    const [testResponses, setTestResponses] = useState<ReadingTestResponse[]>([]);
    const [testPassages, setTestPassages] = useState<GeneratedPassage[]>([]);
    const [cachedAnalysis, setCachedAnalysis] = useState<ReadingAnalysis | null>(null);

    useEffect(() => {
        // Try to restore state from localStorage first
        const savedState = localStorage.getItem('readingAssessmentState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.testResponses && state.testPassages && state.testResponses.length > 0) {
                    // Restore completed test state
                    setProfile(state.profile);
                    setHasProfile(true);
                    setTestResponses(state.testResponses);
                    setTestPassages(state.testPassages);
                    setCachedAnalysis(state.analysis || null);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error('Error restoring state:', err);
                localStorage.removeItem('readingAssessmentState');
            }
        }

        // Check if profile exists
        fetch('/api/reading/profile')
            .then(res => res.json())
            .then(data => {
                if (data && data.id) {
                    setProfile(data);
                    setHasProfile(true);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading reading profile:', err);
                setLoading(false);
            });
    }, []);

    const handleProfileComplete = async (profileData: ReadingProfileData) => {
        try {
            // Save profile to backend
            const response = await fetch('/api/reading/profile', {
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
            console.error('Error saving reading profile:', error);
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
            <ReadingProfile
                onComplete={handleProfileComplete}
                cachedProfile={profile}
            />
        );
    }

    // Handle test completion
    const handleTestComplete = async (responses: ReadingTestResponse[], passages: GeneratedPassage[]) => {
        console.log('Test completed!', responses);

        // Store test results and passages
        setTestResponses(responses);
        setTestPassages(passages);
        setIsTakingTest(false); // Return to results view
        setCachedAnalysis(null);

        // Save state to localStorage so we can restore it when navigating back
        const stateToSave = {
            profile,
            testResponses: responses,
            testPassages: passages,
            analysis: null,
        };
        localStorage.setItem('readingAssessmentState', JSON.stringify(stateToSave));
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
            <ReadingMiniTest
                profile={profile}
                onComplete={handleTestComplete}
                onBack={() => setIsTakingTest(false)} // Go back to results view
            />
        );
    }

    // Profile exists - always show results page first
    // (Results page shows "Take Mini-Test" button if no test results yet)
    return (
        <ReadingAssessmentResults
            profile={profile}
            passages={testPassages}
            responses={testResponses}
            cachedAnalysis={cachedAnalysis || undefined}
            onRetakeAssessment={() => {
                // Reset to questionnaire - user wants to redo the profile
                localStorage.removeItem('readingAssessmentState');
                setTestResponses([]);
                setTestPassages([]);
                setCachedAnalysis(null);
                setHasProfile(false); // Go back to profile questionnaire
            }}
            onRetakeMiniTest={() => {
                // Start (or retake) the mini-test
                localStorage.removeItem('readingAssessmentState');
                setTestResponses([]);
                setTestPassages([]);
                setCachedAnalysis(null);
                setIsTakingTest(true); // Go to mini-test
            }}
        />
    );
}
