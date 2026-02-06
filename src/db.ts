import { Marker, SpeakingSession, WritingSession, ListeningSession, ReadingSession, SrsStats, IntervalsPreview, LearningStatus, SortOption, ReviewRating, Subtitle } from './types';

const API_BASE = '/api';

// Valid modules for flashcards
export type FlashcardModule = 'listening' | 'speaking' | 'reading' | 'writing';

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

    // --- Module-specific Flashcard API ---

    /**
     * Fetch all flashcards for a specific module.
     */
    async fetchModuleCards(module: FlashcardModule): Promise<Marker[]> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards`);
            if (!response.ok) throw new Error(`Failed to fetch ${module} cards`);
            return await response.json();
        } catch (error) {
            console.error(`API fetchModuleCards (${module}) error:`, error);
            return [];
        }
    },

    /**
     * Save a card to a specific module.
     */
    async saveModuleCard(module: FlashcardModule, card: Marker): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(card),
            });
            if (!response.ok) throw new Error(`Failed to save ${module} card`);
        } catch (error) {
            console.error(`API saveModuleCard (${module}) error:`, error);
            throw error;
        }
    },

    /**
     * Delete a card from a specific module.
     */
    async deleteModuleCard(module: FlashcardModule, id: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error(`Failed to delete ${module} card`);
        } catch (error) {
            console.error(`API deleteModuleCard (${module}) error:`, error);
            throw error;
        }
    },

    /**
     * Update specific fields of a card in a specific module.
     */
    async updateModuleCard(module: FlashcardModule, id: string, updates: Partial<Marker>): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) throw new Error(`Failed to update ${module} card`);
        } catch (error) {
            console.error(`API updateModuleCard (${module}) error:`, error);
            throw error;
        }
    },

    // --- SM-2 Spaced Repetition API ---

    /**
     * Fetch all flashcards due for review.
     * Includes learning/relearning cards due NOW, review cards due today, and optionally new cards.
     * 
     * @param module - The module to fetch cards for
     * @param includeNew - Whether to include new cards (default: true)
     * @param sort - Sort order: 'due_first', 'random', 'newest', 'oldest' (default: 'due_first')
     * @param newLimit - Maximum number of new cards to include (optional)
     * @param includePending - Include learning cards even if not due yet (default: false)
     */
    async fetchDueCards(
        module: FlashcardModule,
        includeNew: boolean = true,
        sort: SortOption = 'due_first',
        newLimit?: number,
        includePending: boolean = false
    ): Promise<Marker[]> {
        try {
            const params = new URLSearchParams({
                include_new: String(includeNew),
                sort: sort,
                include_pending: String(includePending),
            });
            if (newLimit !== undefined) {
                params.append('new_limit', String(newLimit));
            }
            const response = await fetch(`${API_BASE}/${module}/cards/due?${params}`);
            if (!response.ok) throw new Error(`Failed to fetch due ${module} cards`);
            return await response.json();
        } catch (error) {
            console.error(`API fetchDueCards (${module}) error:`, error);
            return [];
        }
    },

    /**
     * Submit a review result for a flashcard using Anki-style state machine.
     * @param rating - One of 'again', 'hard', 'good', 'easy'
     */
    async submitReview(module: FlashcardModule, cardId: string, rating: ReviewRating): Promise<Marker | null> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/${cardId}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating }),
            });
            if (!response.ok) throw new Error(`Failed to submit review for ${module} card`);
            return await response.json();
        } catch (error) {
            console.error(`API submitReview (${module}) error:`, error);
            return null;
        }
    },

    /**
     * Get learning status (pending learning/relearning cards).
     */
    async fetchLearningStatus(module: FlashcardModule): Promise<LearningStatus> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/learning-status`);
            if (!response.ok) throw new Error(`Failed to fetch ${module} learning status`);
            return await response.json();
        } catch (error) {
            console.error(`API fetchLearningStatus (${module}) error:`, error);
            return {
                learningCount: 0,
                relearningCount: 0,
                pendingCount: 0,
                dueNowCount: 0,
                nextDueIn: null,
                nextDueTimestamp: null,
            };
        }
    },

    /**
     * Get SRS statistics for a module.
     */
    async fetchSrsStats(module: FlashcardModule): Promise<SrsStats> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/stats`);
            if (!response.ok) throw new Error(`Failed to fetch ${module} SRS stats`);
            return await response.json();
        } catch (error) {
            console.error(`API fetchSrsStats (${module}) error:`, error);
            return {
                total: 0,
                new: 0,
                learning: 0,
                review: 0,
                dueToday: 0,
                mastered: 0,
                averageEaseFactor: 2.5
            };
        }
    },

    /**
     * Preview what intervals would be for each quality rating.
     */
    async previewIntervals(module: FlashcardModule, cardId: string): Promise<IntervalsPreview | null> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/preview-intervals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ card_id: cardId }),
            });
            if (!response.ok) throw new Error(`Failed to preview intervals for ${module} card`);
            return await response.json();
        } catch (error) {
            console.error(`API previewIntervals (${module}) error:`, error);
            return null;
        }
    },

    /**
     * Export all flashcards for a module.
     */
    async exportCards(module: FlashcardModule, format: 'json' | 'csv' = 'json'): Promise<any> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/export?format=${format}`);
            if (!response.ok) throw new Error(`Failed to export ${module} cards`);

            if (format === 'csv') {
                return await response.text();
            }
            return await response.json();
        } catch (error) {
            console.error(`API exportCards (${module}) error:`, error);
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

    /**
     * Get aggregated vocabulary from lessons across segments for practice generation.
     */
    async getGoalVocabulary(
        goalId: string,
        options?: {
            filter?: 'all' | 'recent' | 'unknown' | 'specific';
            limit?: number;
            segmentIndex?: number;
        }
    ): Promise<{
        vocabulary: string[];
        patterns: string[];
        source: {
            segments: number[];
            totalLessons: number;
            totalWords: number;
        };
    }> {
        try {
            const params = new URLSearchParams();
            if (options?.filter) params.append('filter', options.filter);
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.segmentIndex !== undefined) params.append('segment_index', options.segmentIndex.toString());

            const response = await fetch(`${API_BASE}/segment-learning/${goalId}/vocabulary?${params}`);
            if (!response.ok) throw new Error('Failed to fetch vocabulary');
            return await response.json();
        } catch (error) {
            console.error('API getGoalVocabulary error:', error);
            return {
                vocabulary: [],
                patterns: [],
                source: { segments: [], totalLessons: 0, totalWords: 0 }
            };
        }
    },

    // --- File Upload API ---

    /**
     * Fetch all library items.
     */
    async fetchLibrary(): Promise<any[]> {
        try {
            const response = await fetch(`${API_BASE}/library`);
            if (!response.ok) throw new Error('Failed to fetch library');
            return await response.json();
        } catch (error) {
            console.error('API fetchLibrary error:', error);
            return [];
        }
    },

    /**
     * Upload a file to the library.
     */
    async uploadFile(file: File): Promise<{ status: string; id: string }> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload file');
            }
            return await response.json();
        } catch (error) {
            console.error('API uploadFile error:', error);
            throw error;
        }
    },

    // --- Speaking History API ---

    /**
     * Fetch all past speaking sessions.
     */
    async fetchSpeakingSessions(): Promise<SpeakingSession[]> {
        try {
            const response = await fetch(`${API_BASE}/speaking/sessions`);
            if (!response.ok) throw new Error('Failed to fetch speaking sessions');
            return await response.json();
        } catch (error) {
            console.error('API fetchSpeakingSessions error:', error);
            return [];
        }
    },

    // --- Writing History API ---

    /**
     * Fetch all past writing sessions.
     */
    async fetchWritingSessions(): Promise<WritingSession[]> {
        try {
            const response = await fetch(`${API_BASE}/writing/sessions`);
            if (!response.ok) throw new Error('Failed to fetch writing sessions');
            return await response.json();
        } catch (error) {
            console.error('API fetchWritingSessions error:', error);
            return [];
        }
    },

    /**
     * Save a writing session.
     */
    async saveWritingSession(session: { id?: string; topic: string; content: string; contextId?: string; createdAt?: number }): Promise<{ status: string; id: string }> {
        try {
            const response = await fetch(`${API_BASE}/writing/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(session),
            });
            if (!response.ok) {
                let errorMessage = 'Failed to save writing session';
                try {
                    const errorData = await response.json();
                    if (errorData?.error) {
                        errorMessage = errorData.error;
                    }
                } catch (_e) {
                    // Fallback to default message
                }
                throw new Error(errorMessage);
            }
            return await response.json();
        } catch (error) {
            console.error('API saveWritingSession error:', error);
            throw error;
        }
    },

    /**
     * Delete a writing session by ID.
     */
    async deleteWritingSession(sessionId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/writing/sessions/${sessionId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete writing session');
        } catch (error) {
            console.error('API deleteWritingSession error:', error);
            throw error;
        }
    },

    /**
     * Save a completed speaking session.
     */
    async saveSpeakingSession(session: { topic: string; transcript: any[]; durationSeconds: number; createdAt: number }): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/speaking/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(session),
            });
            if (!response.ok) throw new Error('Failed to save speaking session');
        } catch (error) {
            console.error('API saveSpeakingSession error:', error);
            throw error;
        }
    },

    /**
     * Delete a speaking session by ID.
     */
    async deleteSpeakingSession(sessionId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/speaking/sessions/${sessionId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete speaking session');
        } catch (error) {
            console.error('API deleteSpeakingSession error:', error);
            throw error;
        }
    },

    // --- Listening History API ---

    /**
     * Fetch all past listening sessions.
     */
    async fetchListeningSessions(): Promise<ListeningSession[]> {
        try {
            const response = await fetch(`${API_BASE}/listening/sessions`, {
                cache: 'no-store',
            });
            if (!response.ok) throw new Error('Failed to fetch listening sessions');
            return await response.json();
        } catch (error) {
            console.error('API fetchListeningSessions error:', error);
            return [];
        }
    },

    /**
     * Save a listening session.
     */
    async saveListeningSession(session: { prompt: string; audioUrl: string; transcript: any[]; subtitles?: Subtitle[]; durationSeconds: number; contextId?: string; createdAt: number }): Promise<{ status: string; id: string }> {
        try {
            console.log('[API] Saving listening session:');
            console.log('  - Prompt:', session.prompt);
            console.log('  - Audio URL length:', session.audioUrl.length);
            console.log('  - Transcript length:', session.transcript.length);
            console.log('  - Subtitles count:', session.subtitles?.length || 0);
            
            const response = await fetch(`${API_BASE}/listening/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(session),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[API] Save failed:', response.status, errorText);
                throw new Error(`Failed to save listening session: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            console.log('[API] Save successful:', result);
            return result;
        } catch (error) {
            console.error('API saveListeningSession error:', error);
            throw error;
        }
    },

    /**
     * Delete a listening session.
     */
    async deleteListeningSession(sessionId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/listening/sessions/${sessionId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete listening session');
        } catch (error) {
            console.error('API deleteListeningSession error:', error);
            throw error;
        }
    },

    // --- Reading History API ---

    /**
     * Fetch all past reading sessions.
     */
    async fetchReadingSessions(): Promise<ReadingSession[]> {
        try {
            const response = await fetch(`${API_BASE}/reading/sessions`);
            if (!response.ok) throw new Error('Failed to fetch reading sessions');
            return await response.json();
        } catch (error) {
            console.error('API fetchReadingSessions error:', error);
            return [];
        }
    },

    /**
     * Save a reading session.
     */
    async saveReadingSession(session: { prompt: string; title: string; content: string; contextId?: string; createdAt: number }): Promise<{ status: string; id: string }> {
        try {
            const response = await fetch(`${API_BASE}/reading/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(session),
            });
            if (!response.ok) throw new Error('Failed to save reading session');
            return await response.json();
        } catch (error) {
            console.error('API saveReadingSession error:', error);
            throw error;
        }
    },

    /**
     * Delete a reading session.
     */
    async deleteReadingSession(sessionId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/reading/sessions/${sessionId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete reading session');
        } catch (error) {
            console.error('API deleteReadingSession error:', error);
            throw error;
        }
    },

    // --- Statistics & Forecast API ---

    /**
     * Get upcoming card review forecast.
     */
    async fetchForecast(module: FlashcardModule, days: number = 30): Promise<{ forecast: any[], totalDue: number, daysAhead: number } | null> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/forecast?days=${days}`);
            if (!response.ok) throw new Error(`Failed to fetch ${module} forecast`);
            return await response.json();
        } catch (error) {
            console.error(`API fetchForecast (${module}) error:`, error);
            return null;
        }
    },

    /**
     * Get study statistics.
     */
    async fetchStudyStats(module: FlashcardModule, days: number = 30): Promise<any | null> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/study-stats?days=${days}`);
            if (!response.ok) throw new Error(`Failed to fetch ${module} study stats`);
            return await response.json();
        } catch (error) {
            console.error(`API fetchStudyStats (${module}) error:`, error);
            return null;
        }
    },

    /**
     * Get review history for a specific card.
     */
    async fetchCardHistory(module: FlashcardModule, cardId: string): Promise<any[]> {
        try {
            const response = await fetch(`${API_BASE}/${module}/cards/${cardId}/history`);
            if (!response.ok) throw new Error(`Failed to fetch card history`);
            return await response.json();
        } catch (error) {
            console.error(`API fetchCardHistory (${module}) error:`, error);
            return [];
        }
    },

    // --- Assessment Statistics API ---

    /**
     * Fetch assessment statistics with learning curve data.
     * @param window Time window for statistics: 'last_10', 'last_30', or 'all_time'
     */
    async fetchAssessmentStatistics(window: 'last_10' | 'last_30' | 'all_time' = 'last_10'): Promise<any> {
        try {
            const response = await fetch(`${API_BASE}/assessment/statistics?window=${window}`);
            if (!response.ok) throw new Error('Failed to fetch assessment statistics');
            return await response.json();
        } catch (error) {
            console.error('API fetchAssessmentStatistics error:', error);
            throw error;
        }
    },

    /**
     * Fetch all assessment results with optional pagination.
     * @param limit Number of results to fetch (omit for all)
     * @param offset Number of results to skip
     */
    async fetchAllAssessmentResults(limit?: number, offset?: number): Promise<any[]> {
        try {
            const params = new URLSearchParams();
            if (limit !== undefined) params.set('limit', limit.toString());
            if (offset !== undefined) params.set('offset', offset.toString());

            const queryString = params.toString();
            const url = `${API_BASE}/assessment/results${queryString ? '?' + queryString : ''}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch assessment results');
            return await response.json();
        } catch (error) {
            console.error('API fetchAllAssessmentResults error:', error);
            return [];
        }
    },

    /**
     * Delete a specific assessment result and its details.
     * @param resultId UUID of the result to delete
     */
    async deleteAssessmentResult(resultId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE}/assessment/results/${resultId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete assessment result');
            }
        } catch (error) {
            console.error('API deleteAssessmentResult error:', error);
            throw error;
        }
    },

    // --- Practice Sessions API (AI-generated practice dialogues) ---
};

