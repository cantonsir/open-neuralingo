import { Marker } from './types';

const API_BASE = '/api';

export interface HistoryItem {
    videoId: string;
    title: string;
    thumbnail: string;
    watchedAt: number;
    duration?: string;
    wordsLearned?: number;
}

// Learning Session Types
export interface LessonItem {
    id: string;
    videoId: string;
    segmentIndex: number;
    originalText: string;
    variations: string[];
    audioData: string[];
    attempts: number;
    understood: number;
    lastSeen: string | null;
}

export interface SegmentProgress {
    videoId: string;
    segmentIndex: number;
    totalItems: number;
    completedItems: number;
    isUnlocked: boolean;
    progress: number;
}

export interface LessonProgressResponse {
    status: string;
    attempts: number;
    understood: number;
    ratio: number;
}

// Goal Video Types (Learning Section)
export interface GoalVideo {
    id: string;
    videoId: string;
    title: string;
    thumbnail: string;
    language: string;
    durationSeconds: number;
    segmentDuration: number;
    totalSegments: number;
    completedSegments: number;
    overallProgress: number;
    createdAt: string;
    lastStudiedAt: string | null;
}

export interface TranscriptLanguage {
    code: string;
    name: string;
    isGenerated: boolean;
    isTranslatable: boolean;
}

export interface Segment {
    index: number;
    startTime: number;
    endTime: number;
    sentences: number;
    preview: string;
    isUnlocked: boolean;
    progress: number;
}

export interface GoalVideoDetail extends GoalVideo {
    segments: Segment[];
}

// Segment Learning Types (Test-Learn-Watch Flow)
export interface SegmentMastery {
    testAttempts: number;
    bestAccuracy: number;
    isMastered: boolean;
    videoWatched: boolean;
    lastTestAt: number | null;
}

export interface SegmentTestResult {
    id: string;
    attemptNumber: number;
    takenAt: number;
    score: number;
    totalQuestions: number;
    accuracy: number;
    sentences: Array<{ id: number; sentence: string; difficulty: string }>;
    analysis: {
        overallLevel?: string;
        strengths?: string[];
        weaknesses?: string[];
        recommendations?: string[];
        summary?: string;
    } | null;
    responses: Array<{
        sentence: string;
        understood: boolean;
        replays: number;
        reactionTimeMs: number;
        markedIndices: number[];
    }>;
}

export interface SegmentLesson {
    id: string;
    testId: string | null;
    type: string;
    content: {
        title?: string;
        description?: string;
        words?: Array<{ word: string; meaning: string; example: string }>;
        sentences?: Array<{ original: string; slow: boolean; explanation?: string }>;
        patterns?: Array<{ pattern: string; examples: string[] }>;
    };
    createdAt: number;
    completed: boolean;
}

export const api = {
    /**
     * Fetch all saved flashcards from the persistent database.
     */
    async fetchCards(): Promise<Marker[]> {
        try {
            const response = await fetch(`${API_BASE}/cards`);
            if (!response.ok) throw new Error('Failed to fetch cards');
            return await response.json();
        } catch (error) {
            console.error('API fetchCards error:', error);
            return [];
        }
    },

    /**
     * Save a single card to the persistent database.
     */
    async saveCard(card: Marker): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(card),
            });
            if (!response.ok) throw new Error('Failed to save card');
        } catch (error) {
            console.error('API saveCard error:', error);
            throw error; // Propagate so caller knows it failed
        }
    },

    /**
     * Delete a card by ID.
     */
    async deleteCard(id: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/cards/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete card');
        } catch (error) {
            console.error('API deleteCard error:', error);
            throw error;
        }
    },

    /**
     * Update specific fields of a card.
     */
    async updateCard(id: string, updates: Partial<Marker>): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/cards/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) throw new Error('Failed to update card');
        } catch (error) {
            console.error('API updateCard error:', error);
            throw error;
        }
    },

    // --- Watch History API ---

    /**
     * Fetch all watch history from the persistent database.
     */
    async fetchHistory(): Promise<HistoryItem[]> {
        try {
            const response = await fetch(`${API_BASE}/history`);
            if (!response.ok) throw new Error('Failed to fetch history');
            return await response.json();
        } catch (error) {
            console.error('API fetchHistory error:', error);
            return [];
        }
    },

    /**
     * Save a video to watch history.
     */
    async saveToHistory(item: HistoryItem): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });
            if (!response.ok) throw new Error('Failed to save to history');
        } catch (error) {
            console.error('API saveToHistory error:', error);
            throw error;
        }
    },

    /**
     * Delete a single video from history.
     */
    async deleteFromHistory(videoId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/history/${videoId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete from history');
        } catch (error) {
            console.error('API deleteFromHistory error:', error);
            throw error;
        }
    },

    /**
     * Clear all watch history.
     */
    async clearHistory(): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/history`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to clear history');
        } catch (error) {
            console.error('API clearHistory error:', error);
            throw error;
        }
    },

    // --- Learning Session API ---

    /**
     * Generate lessons from a video segment transcript.
     */
    async generateLessons(videoId: string, segmentIndex: number, sentences: string[], userLevel: string = 'intermediate'): Promise<{ status: string; itemsCreated?: number; items?: { id: string; originalText: string }[] }> {
        try {
            const response = await fetch(`${API_BASE}/lessons/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId,
                    segmentIndex,
                    transcriptText: sentences,
                    userLevel,
                }),
            });
            if (!response.ok) throw new Error('Failed to generate lessons');
            return await response.json();
        } catch (error) {
            console.error('API generateLessons error:', error);
            throw error;
        }
    },

    /**
     * Fetch lessons for a video segment.
     */
    async fetchLessons(videoId: string, segmentIndex: number): Promise<LessonItem[]> {
        try {
            const response = await fetch(`${API_BASE}/lessons/${videoId}/${segmentIndex}`);
            if (!response.ok) throw new Error('Failed to fetch lessons');
            return await response.json();
        } catch (error) {
            console.error('API fetchLessons error:', error);
            return [];
        }
    },

    /**
     * Record user's response to a lesson item.
     */
    async updateLessonProgress(itemId: string, understood: boolean): Promise<LessonProgressResponse> {
        try {
            const response = await fetch(`${API_BASE}/lessons/${itemId}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ understood }),
            });
            if (!response.ok) throw new Error('Failed to update progress');
            return await response.json();
        } catch (error) {
            console.error('API updateLessonProgress error:', error);
            throw error;
        }
    },

    /**
     * Store AI-generated variations for a lesson item.
     */
    async updateLessonVariations(itemId: string, variations: string[], audioData: string[]): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/lessons/${itemId}/variations`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variations, audioData }),
            });
            if (!response.ok) throw new Error('Failed to update variations');
        } catch (error) {
            console.error('API updateLessonVariations error:', error);
            throw error;
        }
    },

    /**
     * Fetch progress for all segments of a video.
     */
    async fetchSegmentProgress(videoId: string): Promise<SegmentProgress[]> {
        try {
            const response = await fetch(`${API_BASE}/segments/${videoId}`);
            if (!response.ok) throw new Error('Failed to fetch segment progress');
            return await response.json();
        } catch (error) {
            console.error('API fetchSegmentProgress error:', error);
            return [];
        }
    },

    // --- Goal Videos API (Learning Section) ---

    /**
     * Fetch all goal videos.
     */
    async fetchGoals(): Promise<GoalVideo[]> {
        try {
            const response = await fetch(`${API_BASE}/goals`);
            if (!response.ok) throw new Error('Failed to fetch goals');
            return await response.json();
        } catch (error) {
            console.error('API fetchGoals error:', error);
            return [];
        }
    },

    /**
     * Fetch available subtitle languages for a video.
     */
    async fetchTranscriptLanguages(videoId: string): Promise<TranscriptLanguage[]> {
        try {
            const response = await fetch(`${API_BASE}/transcript/languages?videoId=${videoId}`);
            if (!response.ok) throw new Error('Failed to fetch languages');
            const data = await response.json();
            return data.languages || [];
        } catch (error) {
            console.error('API fetchTranscriptLanguages error:', error);
            return [];
        }
    },

    /**
     * Create a new goal video.
     */
    async createGoal(videoId: string, language: string = 'en', title?: string): Promise<{ status: string; id?: string; totalSegments?: number }> {
        try {
            const response = await fetch(`${API_BASE}/goals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId, language, title }),
            });
            if (!response.ok) throw new Error('Failed to create goal');
            return await response.json();
        } catch (error) {
            console.error('API createGoal error:', error);
            throw error;
        }
    },

    /**
     * Fetch a specific goal video with segments.
     */
    async fetchGoal(goalId: string): Promise<GoalVideoDetail | null> {
        try {
            const response = await fetch(`${API_BASE}/goals/${goalId}`);
            if (!response.ok) throw new Error('Failed to fetch goal');
            return await response.json();
        } catch (error) {
            console.error('API fetchGoal error:', error);
            return null;
        }
    },

    /**
     * Delete a goal video.
     */
    async deleteGoal(goalId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/goals/${goalId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete goal');
        } catch (error) {
            console.error('API deleteGoal error:', error);
            throw error;
        }
    },

    /**
     * Fetch sentences for a specific segment.
     */
    async fetchSegmentSentences(goalId: string, segmentIndex: number): Promise<{ sentences: string[]; count: number }> {
        try {
            const response = await fetch(`${API_BASE}/goals/${goalId}/segment/${segmentIndex}/sentences`);
            if (!response.ok) throw new Error('Failed to fetch sentences');
            return await response.json();
        } catch (error) {
            console.error('API fetchSegmentSentences error:', error);
            return { sentences: [], count: 0 };
        }
    },

    // --- Segment Learning API (Test-Learn-Watch Flow) ---

    /**
     * Get mastery status for a segment.
     */
    async getSegmentMastery(goalId: string, segmentIndex: number): Promise<SegmentMastery> {
        try {
            const response = await fetch(`${API_BASE}/segment-learning/${goalId}/${segmentIndex}/mastery`);
            if (!response.ok) throw new Error('Failed to fetch mastery');
            return await response.json();
        } catch (error) {
            console.error('API getSegmentMastery error:', error);
            return { testAttempts: 0, bestAccuracy: 0, isMastered: false, videoWatched: false, lastTestAt: null };
        }
    },

    /**
     * Save a segment test result.
     */
    async saveSegmentTest(
        goalId: string,
        segmentIndex: number,
        data: {
            sentences: Array<{ id: number; sentence: string; difficulty: string }>;
            responses: Array<{
                sentence: string;
                understood: boolean;
                replays: number;
                reactionTimeMs: number;
                markedIndices: number[];
            }>;
            analysis: object;
        }
    ): Promise<{ status: string; testId: string; attemptNumber: number; score: number; accuracy: number; isMastered: boolean }> {
        try {
            const response = await fetch(`${API_BASE}/segment-learning/${goalId}/${segmentIndex}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to save test');
            return await response.json();
        } catch (error) {
            console.error('API saveSegmentTest error:', error);
            throw error;
        }
    },

    /**
     * Get all test attempts for a segment.
     */
    async getSegmentTests(goalId: string, segmentIndex: number): Promise<SegmentTestResult[]> {
        try {
            const response = await fetch(`${API_BASE}/segment-learning/${goalId}/${segmentIndex}/tests`);
            if (!response.ok) throw new Error('Failed to fetch tests');
            return await response.json();
        } catch (error) {
            console.error('API getSegmentTests error:', error);
            return [];
        }
    },

    /**
     * Save AI-generated lessons for a segment.
     */
    async saveSegmentLessons(
        goalId: string,
        segmentIndex: number,
        data: {
            testId: string;
            lessons: Array<{ type: string; content: object }>;
        }
    ): Promise<{ status: string; lessonIds: string[]; count: number }> {
        try {
            const response = await fetch(`${API_BASE}/segment-learning/${goalId}/${segmentIndex}/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to save lessons');
            return await response.json();
        } catch (error) {
            console.error('API saveSegmentLessons error:', error);
            throw error;
        }
    },

    /**
     * Get all lessons for a segment.
     */
    async getSegmentLessons(goalId: string, segmentIndex: number): Promise<SegmentLesson[]> {
        try {
            const response = await fetch(`${API_BASE}/segment-learning/${goalId}/${segmentIndex}/lessons`);
            if (!response.ok) throw new Error('Failed to fetch lessons');
            return await response.json();
        } catch (error) {
            console.error('API getSegmentLessons error:', error);
            return [];
        }
    },

    /**
     * Mark a lesson as completed.
     */
    async completeSegmentLesson(goalId: string, segmentIndex: number, lessonId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/segment-learning/${goalId}/${segmentIndex}/lessons/${lessonId}/complete`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to complete lesson');
        } catch (error) {
            console.error('API completeSegmentLesson error:', error);
            throw error;
        }
    },

    /**
     * Mark segment as watched (video completed).
     */
    async markSegmentWatched(goalId: string, segmentIndex: number): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/segment-learning/${goalId}/${segmentIndex}/watch`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to mark watched');
        } catch (error) {
            console.error('API markSegmentWatched error:', error);
            throw error;
        }
    },
};

