/**
 * useAssessmentStats Hook
 *
 * Fetches and manages assessment statistics data with caching support.
 */

import { useState, useEffect } from 'react';
import * as api from '../db';

interface ScoreTrendData {
  testNumber: number;
  date: number;
  score: number;
  replays: number;
  reactionTime: number;
}

interface WeaknessEvolution {
  [weaknessType: string]: number[];
}

interface AssessmentStatsSummary {
  totalTests: number;
  avgScore: number;
  bestScore: number;
  improvementRate: string;
}

export interface AssessmentStats {
  summary: AssessmentStatsSummary;
  scoreTrend: ScoreTrendData[];
  weaknessEvolution: WeaknessEvolution;
  computedAt: number;
}

type TimeWindow = 'last_10' | 'last_30' | 'all_time';

export function useAssessmentStats(window: TimeWindow = 'last_10') {
  const [stats, setStats] = useState<AssessmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = async (timeWindow: TimeWindow) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.fetchAssessmentStatistics(timeWindow);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
      console.error('Error fetching assessment statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics(window);
  }, [window]);

  const refetch = () => {
    return fetchStatistics(window);
  };

  return { stats, loading, error, refetch };
}
