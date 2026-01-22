import { Marker } from './types';

const API_BASE = '/api';

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
    }
};
