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
};

