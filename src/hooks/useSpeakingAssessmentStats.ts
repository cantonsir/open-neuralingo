/**
 * useSpeakingAssessmentStats Hook
 *
 * Fetches and manages speaking assessment statistics data.
 */

import { useState, useEffect, useCallback } from 'react';

export interface ScoreTrendData {
    testNumber: number;
    date: number;
    translationAccuracy: number;
    conversationCoherence: number;
    overallLevel: number;
}

interface WeaknessEvolution {
    [weaknessType: string]: number[];
}

interface SpeakingAssessmentStatsSummary {
    totalTests: number;
    avgTranslationAccuracy: number;
    avgConversationCoherence: number;
    currentLevel: number;
    bestAccuracy: number;
    improvementRate: string;
}

export interface SpeakingAssessmentStats {
    summary: SpeakingAssessmentStatsSummary;
    scoreTrend: ScoreTrendData[];
    weaknessEvolution: WeaknessEvolution;
    computedAt: number;
}

export type TimeWindow = 'last_10' | 'last_30' | 'all_time';

export function useSpeakingAssessmentStats(window: TimeWindow = 'last_10') {
    const [stats, setStats] = useState<SpeakingAssessmentStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatistics = useCallback(async (timeWindow: TimeWindow) => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/speaking/statistics?window=${timeWindow}`);
            if (!response.ok) {
                throw new Error('Failed to fetch speaking statistics');
            }

            const data = await response.json();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
            console.error('Error fetching speaking assessment statistics:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatistics(window);
    }, [window, fetchStatistics]);

    const refetch = useCallback(() => {
        return fetchStatistics(window);
    }, [window, fetchStatistics]);

    return { stats, loading, error, refetch };
}
