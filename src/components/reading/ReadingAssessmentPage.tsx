import React, { useState, useEffect } from 'react';
import ReadingProfile, { ReadingProfileData } from './ReadingProfile';
import ReadingMiniTest from './ReadingMiniTest';
import ReadingTestAnalysis from './ReadingTestAnalysis';
import { ReadingTestResponse } from '../../hooks/useReadingTest';
import { GeneratedPassage } from '../../services/geminiService';
import { api } from '../../db';

export default function ReadingAssessmentPage() {
    const [hasProfile, setHasProfile] = useState<boolean>(false);
    const [profile, setProfile] = useState<ReadingProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [testCompleted, setTestCompleted] = useState(false);
    const [testResponses, setTestResponses] = useState<ReadingTestResponse[]>([]);
    const [testPassages, setTestPassages] = useState<GeneratedPassage[]>([]);

    useEffect(() => {
        // Try to restore state from localStorage first
        const savedState = localStorage.getItem('readingAssessmentState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.testCompleted && state.testResponses && state.testPassages) {
                    // Restore completed test state
                    setProfile(state.profile);
                    setHasProfile(true);
                    setTestCompleted(true);
                    setTestResponses(state.testResponses);
                    setTestPassages(state.testPassages);
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
        setTestCompleted(true);

        // Save state to localStorage so we can restore it when navigating back
        const stateToSave = {
            profile,
            testCompleted: true,
            testResponses: responses,
            testPassages: passages,
        };
        localStorage.setItem('readingAssessmentState', JSON.stringify(stateToSave));
    };

    // Once profile exists, show test interface
    if (!profile) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
            </div>
        );
    }

    // Show analysis if test is completed
    if (testCompleted) {
        return (
            <ReadingTestAnalysis
                profile={profile}
                passages={testPassages}
                responses={testResponses}
                onRetakeAssessment={() => {
                    // Clear saved state and reset to take new test
                    localStorage.removeItem('readingAssessmentState');
                    setTestCompleted(false);
                    setTestResponses([]);
                    setTestPassages([]);
                }}
                onStartLearning={() => {
                    // TODO: Navigate to learning plan
                    alert('Learning plan feature coming soon!');
                }}
            />
        );
    }

    return (
        <ReadingMiniTest
            profile={profile}
            onComplete={handleTestComplete}
            onBack={() => setHasProfile(false)}
        />
    );
}
