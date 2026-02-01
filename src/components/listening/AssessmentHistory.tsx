/**
 * Assessment History Component
 *
 * Full history modal displaying all assessment test results
 * with timeline layout, expansion details, and CSV export.
 */

import React, { useState, useEffect } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { api } from '../../db';

interface AssessmentResult {
  id: string;
  takenAt: number;
  score: number;
  totalQuestions: number;
  analysis: {
    strengths?: string[];
    weaknesses?: string[];
    feedback?: string;
  } | null;
  responses: Array<{
    sentenceId: number;
    sentence: string;
    understood: boolean;
    replays: number;
    reactionTimeMs: number;
    markedIndices: number[];
  }>;
}

interface GroupedResults {
  [monthYear: string]: AssessmentResult[];
}

interface AssessmentHistoryProps {
  onClose: () => void;
}

const AssessmentHistory: React.FC<AssessmentHistoryProps> = ({ onClose }) => {
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadAllResults();
  }, []);

  const loadAllResults = async () => {
    try {
      setLoading(true);
      const data = await api.fetchAllAssessmentResults();
      setResults(data);
    } catch (error) {
      console.error('Failed to load assessment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (resultId: string) => {
    try {
      setDeletingId(resultId);
      await api.deleteAssessmentResult(resultId);

      // Remove from local state
      setResults(prev => prev.filter(r => r.id !== resultId));

      // Show success message
      console.log('Result deleted successfully');
    } catch (error) {
      console.error('Failed to delete result:', error);
      alert('Failed to delete result. Please try again.');
    } finally {
      setDeletingId(null);
      setShowDeleteConfirm(null);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const exportToCSV = () => {
    if (results.length === 0) return;

    // CSV headers
    const headers = ['Date', 'Score', 'Total Questions', 'Percentage', 'Total Replays', 'Avg Reaction Time (ms)', 'Strengths', 'Weaknesses'];

    // CSV rows
    const rows = results.map(result => {
      const date = new Date(result.takenAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const percentage = ((result.score / result.totalQuestions) * 100).toFixed(1);
      const totalReplays = result.responses.reduce((sum, r) => sum + r.replays, 0);
      const avgReactionTime = result.responses.length > 0
        ? Math.round(result.responses.reduce((sum, r) => sum + r.reactionTimeMs, 0) / result.responses.length)
        : 0;
      const strengths = result.analysis?.strengths?.join('; ') || 'N/A';
      const weaknesses = result.analysis?.weaknesses?.join('; ') || 'N/A';

      return [
        date,
        result.score,
        result.totalQuestions,
        `${percentage}%`,
        totalReplays,
        avgReactionTime,
        `"${strengths}"`,
        `"${weaknesses}"`
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `assessment_history_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupByMonth = (results: AssessmentResult[]): GroupedResults => {
    const grouped: GroupedResults = {};

    results.forEach(result => {
      const date = new Date(result.takenAt);
      const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(result);
    });

    return grouped;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-4xl w-full mx-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
          </div>
        </div>
      </div>
    );
  }

  const groupedResults = groupByMonth(results);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Assessment History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Export Button */}
        <div className="px-6 pt-4">
          <button
            onClick={exportToCSV}
            disabled={results.length === 0}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No assessment history available yet.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedResults).map(([monthYear, monthResults]) => (
                <div key={monthYear}>
                  {/* Month Header */}
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600">
                    {monthYear}
                  </h3>

                  {/* Results for this month */}
                  <div className="space-y-3">
                    {monthResults.map(result => {
                      const isExpanded = expandedIds.has(result.id);
                      const date = new Date(result.takenAt);
                      const formattedDate = date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      });
                      const formattedTime = date.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const totalReplays = result.responses.reduce((sum, r) => sum + r.replays, 0);
                      const percentage = ((result.score / result.totalQuestions) * 100).toFixed(0);

                      // Score color coding
                      let scoreColor = 'text-red-600 dark:text-red-400';
                      if (result.score >= 8) {
                        scoreColor = 'text-green-600 dark:text-green-400';
                      } else if (result.score >= 5) {
                        scoreColor = 'text-yellow-600 dark:text-yellow-400';
                      }

                      return (
                        <div
                          key={result.id}
                          className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                          {/* Summary Row */}
                          <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                            <button
                              onClick={() => toggleExpand(result.id)}
                              className="flex items-center space-x-4 flex-1 text-left"
                            >
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[80px]">
                                {formattedDate} • {formattedTime}
                              </span>
                              <span className={`text-lg font-bold ${scoreColor}`}>
                                {result.score}/{result.totalQuestions}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                ({percentage}%)
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {totalReplays} replays
                              </span>
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDeleteConfirm(result.id);
                                }}
                                disabled={deletingId === result.id}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete this result"
                              >
                                {deletingId === result.id ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <Trash2 size={18} />
                                )}
                              </button>
                              <svg
                                className={`w-5 h-5 text-gray-500 transition-transform ${
                                  isExpanded ? 'transform rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                              {/* Analysis Section */}
                              {result.analysis && (
                                <div className="mt-4 space-y-3">
                                  {result.analysis.strengths && result.analysis.strengths.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                                        Strengths:
                                      </h4>
                                      <ul className="list-disc list-inside space-y-1">
                                        {result.analysis.strengths.map((strength, idx) => (
                                          <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                                            {strength}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {result.analysis.weaknesses && result.analysis.weaknesses.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                                        Weaknesses:
                                      </h4>
                                      <ul className="list-disc list-inside space-y-1">
                                        {result.analysis.weaknesses.map((weakness, idx) => (
                                          <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                                            {weakness}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {result.analysis.feedback && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Feedback:
                                      </h4>
                                      <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {result.analysis.feedback}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Responses Section */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Detailed Responses:
                                </h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {result.responses.map((response, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-white dark:bg-gray-900 rounded p-3 text-sm"
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <span className="font-medium text-gray-900 dark:text-white">
                                          Question {idx + 1}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            response.understood
                                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                          }`}
                                        >
                                          {response.understood ? 'Understood' : 'Not Understood'}
                                        </span>
                                      </div>
                                      <p className="text-gray-700 dark:text-gray-300 mb-2">
                                        {response.sentence}
                                      </p>
                                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                                        <span>{response.replays} replays</span>
                                        <span>{response.reactionTimeMs}ms reaction</span>
                                        {response.markedIndices.length > 0 && (
                                          <span>{response.markedIndices.length} words marked</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Delete Test Result?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This action cannot be undone. The test result and all its details will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentHistory;
