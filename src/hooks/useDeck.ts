import { useState, useEffect, useCallback } from 'react';
import { Marker } from '../types';
import { api } from '../db';

export function useDeck() {
    const [savedCards, setSavedCards] = useState<Marker[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved cards on mount
    useEffect(() => {
        const loadCards = async () => {
            setIsLoading(true);
            // 1. Migration: Check localStorage
            const local = localStorage.getItem('saved_flashcards');
            if (local) {
                try {
                    const localCards: Marker[] = JSON.parse(local);
                    console.log("Migrating cards to DB...", localCards.length);
                    for (const c of localCards) {
                        await api.saveCard(c);
                    }
                    localStorage.removeItem('saved_flashcards');
                } catch (e) {
                    console.error("Migration failed", e);
                }
            }

            // 2. Load from DB
            try {
                const cards = await api.fetchCards();
                setSavedCards(cards);
            } catch (e) {
                console.error("Failed to load cards", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadCards();
    }, []);

    // Save cards handler
    const saveCard = useCallback(async (marker: Marker) => {
        // Optimistic UI update
        setSavedCards(prev => {
            if (prev.some(c => c.id === marker.id)) return prev;
            return [...prev, marker];
        });

        try {
            await api.saveCard(marker);
        } catch (e) {
            console.error("Failed to save card to DB", e);
            // Revert if failed
            setSavedCards(prev => prev.filter(c => c.id !== marker.id));
            throw e; // Re-throw for caller to handle UI feedback if needed
        }
    }, []);

    const deleteCard = useCallback(async (id: string) => {
        setSavedCards(prev => prev.filter(c => c.id !== id));
        try {
            await api.deleteCard(id);
        } catch (e) {
            console.error("Failed to delete card", e);
            // Revert logic could go here (fetching again)
            const cards = await api.fetchCards();
            setSavedCards(cards);
            throw e;
        }
    }, []);

    const updateCard = useCallback(async (id: string, updates: Partial<Marker>) => {
        setSavedCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        try {
            await api.updateCard(id, updates);
        } catch (e) {
            console.error("Failed to update card", e);
            // Could revert here too
            throw e;
        }
    }, []);

    return {
        savedCards,
        isLoading,
        saveCard,
        deleteCard,
        updateCard
    };
}
