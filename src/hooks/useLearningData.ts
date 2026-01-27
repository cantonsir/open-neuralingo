import { useState, useEffect, useCallback } from 'react';
import { api, GoalVideo, GoalVideoDetail } from '../db';

export function useLearningData() {
  // Assessment data cache
  const [assessmentProfile, setAssessmentProfile] = useState<any>(null);
  const [assessmentResults, setAssessmentResults] = useState<any[] | null>(null);
  const [assessmentLoaded, setAssessmentLoaded] = useState(false);

  // Learning goals cache
  const [learningGoals, setLearningGoals] = useState<GoalVideo[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  // Course details cache (GoalVideoDetail by goalId)
  const [goalDetailsCache, setGoalDetailsCache] = useState<Record<string, GoalVideoDetail>>({});

  // Load all cached data once on mount
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const [profileRes, resultsRes, goals] = await Promise.all([
          fetch('/api/assessment/profile'),
          fetch('/api/assessment/results'),
          api.fetchGoals()
        ]);

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setAssessmentProfile(profile);
        }

        if (resultsRes.ok) {
          const results = await resultsRes.json();
          if (results && results.length > 0) {
            setAssessmentResults(results);
          }
        }

        setLearningGoals(goals);
      } catch (error) {
        console.error('Failed to load cached data:', error);
      } finally {
        setAssessmentLoaded(true);
        setGoalsLoaded(true);
      }
    };
    loadCachedData();
  }, []);

  // Callback to refresh assessment data after updates
  const refreshAssessmentData = useCallback(async () => {
    try {
      const [profileRes, resultsRes] = await Promise.all([
        fetch('/api/assessment/profile'),
        fetch('/api/assessment/results')
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setAssessmentProfile(profile);
      }

      if (resultsRes.ok) {
        const results = await resultsRes.json();
        setAssessmentResults(results && results.length > 0 ? results : null);
      }
    } catch (error) {
      console.error('Failed to refresh assessment data:', error);
    }
  }, []);

  // Update goal details cache
  const refreshGoalDetails = useCallback(async (goalId: string) => {
    try {
      const details = await api.fetchGoal(goalId);
      if (details) {
        setGoalDetailsCache(prev => ({ ...prev, [goalId]: details }));
      }
    } catch (e) {
      console.error("Failed to refresh goal details", e);
    }
  }, []);

  return {
    assessmentProfile,
    setAssessmentProfile,
    assessmentResults,
    setAssessmentResults,
    assessmentLoaded,
    learningGoals,
    setLearningGoals,
    goalsLoaded,
    goalDetailsCache,
    refreshAssessmentData,
    refreshGoalDetails,
  };
}
