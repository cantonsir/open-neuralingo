import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Lock, CheckCircle, Clock, BookOpen, Loader2, Target, Headphones } from 'lucide-react';
import { api, GoalVideoDetail, Segment } from '../../db';

interface CourseDashboardProps {
    goalId: string;
    onBack: () => void;
    onStartLesson: (goalId: string, segmentIndex: number, videoId: string, startTime: number, endTime: number) => void;
    onWatchVideo: (videoId: string) => void;
    cachedGoal?: GoalVideoDetail;
    onCacheUpdate?: (goalId: string) => void;
}

const CourseDashboard: React.FC<CourseDashboardProps> = ({ goalId, onBack, onStartLesson, onWatchVideo, cachedGoal, onCacheUpdate }) => {
    const [goal, setGoal] = useState<GoalVideoDetail | null>(cachedGoal || null);
    const [isLoading, setIsLoading] = useState(!cachedGoal);

    useEffect(() => {
        if (!cachedGoal) {
            loadGoal();
        } else {
            // If we have a cache but goalId changed (unlikely given keying, but good practice), or just to be safe:
            if (goal?.id !== goalId) {
                setGoal(cachedGoal);
                setIsLoading(false);
            }
        }
    }, [goalId, cachedGoal]);

    const loadGoal = async () => {
        setIsLoading(true);
        const fetchedGoal = await api.fetchGoal(goalId);
        setGoal(fetchedGoal);
        setIsLoading(false);
        if (fetchedGoal && onCacheUpdate) {
            onCacheUpdate(goalId);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getSegmentStatus = (segment: Segment): 'locked' | 'in-progress' | 'completed' => {
        if (!segment.isUnlocked) return 'locked';
        if (segment.progress >= 80) return 'completed';
        return 'in-progress';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-950">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            </div>
        );
    }

    if (!goal) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-950">
                <p className="text-gray-500">Goal not found</p>
            </div>
        );
    }

    const completedCount = goal.segments.filter(s => s.isUnlocked && s.progress >= 80).length;
    const overallProgress = goal.segments.length > 0
        ? (completedCount / goal.segments.length) * 100
        : 0;

    return (
        <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-950">
            {/* Header with Video Info */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-4xl mx-auto p-6">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Goals
                    </button>

                    <div className="flex gap-6">
                        {/* Thumbnail */}
                        <div className="w-64 h-36 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                            <img
                                src={goal.thumbnail}
                                alt={goal.title}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                {goal.title}
                            </h1>

                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {formatTime(goal.durationSeconds)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <BookOpen className="w-4 h-4" />
                                    {goal.totalSegments} lessons
                                </span>
                                <span className="flex items-center gap-1">
                                    <Target className="w-4 h-4" />
                                    {completedCount}/{goal.segments.length} completed
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                                        style={{ width: `${overallProgress}%` }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => goal && onWatchVideo(goal.videoId)}
                                className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                            >
                                <Headphones className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Practice with Full Video
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lessons List */}
            <div className="max-w-4xl mx-auto p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-yellow-500" />
                    Lessons
                </h2>

                <div className="space-y-3">
                    {goal.segments.map((segment, idx) => {
                        const status = getSegmentStatus(segment);
                        const isClickable = segment.isUnlocked;

                        return (
                            <div
                                key={segment.index}
                                onClick={() => isClickable && onStartLesson(goalId, segment.index, goal.videoId, segment.startTime, segment.endTime)}
                                className={`
                                    flex items-center gap-4 p-4 rounded-xl border transition-all
                                    ${isClickable
                                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-yellow-500/50 hover:shadow-lg cursor-pointer'
                                        : 'bg-gray-100 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/50 opacity-60 cursor-not-allowed'
                                    }
                                `}
                            >
                                {/* Status Icon */}
                                <div className={`
                                    w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                                    ${status === 'completed'
                                        ? 'bg-green-100 dark:bg-green-500/20'
                                        : status === 'in-progress'
                                            ? 'bg-yellow-100 dark:bg-yellow-500/20'
                                            : 'bg-gray-100 dark:bg-gray-800'
                                    }
                                `}>
                                    {status === 'completed' ? (
                                        <CheckCircle className="w-6 h-6 text-green-500" />
                                    ) : status === 'locked' ? (
                                        <Lock className="w-6 h-6 text-gray-400" />
                                    ) : (
                                        <Play className="w-6 h-6 text-yellow-500" fill="currentColor" />
                                    )}
                                </div>

                                {/* Lesson Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            Lesson {idx + 1}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        {segment.preview || `${segment.sentences} sentences`}
                                    </p>
                                </div>

                                {/* Progress */}
                                {segment.isUnlocked && status === 'completed' && (
                                    <div className="flex items-center gap-2 text-green-500">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="text-sm font-medium">Done</span>
                                    </div>
                                )}

                                {segment.isUnlocked && status === 'in-progress' && (
                                    <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20 px-2 py-1 rounded font-medium">
                                        In Progress
                                    </span>
                                )}

                                {!segment.isUnlocked && (
                                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                        Complete previous lesson
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CourseDashboard;
