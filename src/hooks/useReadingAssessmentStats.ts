/**
 * useReadingAssessmentStats Hook
 *
 * Fetches and manages reading assessment statistics data.
 */

import { useState, useEffect, useCallback } from 'react';

interface ScoreTrendData {
    testNumber: number;
    date: number;
    vocabularyCoverage: number;
    sentenceComprehension: number;
    overallLevel: number;
}

interface WeaknessEvolution {
    [weaknessType: string]: number[];
}

interface ReadingAssessmentStatsSummary {
    totalTests: number;
    avgVocabCoverage: number;
    avgComprehension: number;
    currentLevel: number;
    bestVocabCoverage: number;
    improvementRate: string;
}

export interface ReadingAssessmentStats {
    summary: ReadingAssessmentStatsSummary;
    scoreTrend: ScoreTrendData[];
    weaknessEvolution: WeaknessEvolution;
    computedAt: number;
}

type TimeWindow = 'last_10' | 'last_30' | 'all_time';

export function useReadingAssessmentStats(window: TimeWindow = 'last_10') {
    const [stats, setStats] = useState<ReadingAssessmentStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatistics = useCallback(async (timeWindow: TimeWindow) => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/reading/statistics?window=${timeWindow}`);
            if (!response.ok) {
                throw new Error('Failed to fetch reading statistics');
            }

            const data = await response.json();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
            console.error('Error fetching reading assessment statistics:', err);
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
