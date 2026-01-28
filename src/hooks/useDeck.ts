import { useState, useEffect, useCallback } from 'react';
import { Marker } from '../types';
import { api, FlashcardModule } from '../db';

export function useDeck(module: FlashcardModule = 'listening') {
    const [savedCards, setSavedCards] = useState<Marker[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved cards on mount or when module changes
    useEffect(() => {
        const loadCards = async () => {
            setIsLoading(true);
            
            // Note: Migration logic removed as it was one-time for legacy 'flashcards' table
            // and backend now handles migration or we assume migration ran on backend start.

            // Load from DB for specific module
            try {
                const cards = await api.fetchModuleCards(module);
                setSavedCards(cards);
            } catch (e) {
                console.error(`Failed to load cards for ${module}`, e);
            } finally {
                setIsLoading(false);
            }
        };
        loadCards();
    }, [module]);

    // Save cards handler
    const saveCard = useCallback(async (marker: Marker) => {
        // Optimistic UI update
        setSavedCards(prev => {
            if (prev.some(c => c.id === marker.id)) return prev;
            return [...prev, marker];
        });

        try {
            await api.saveModuleCard(module, marker);
        } catch (e) {
            console.error(`Failed to save card to ${module} DB`, e);
            // Revert if failed
            setSavedCards(prev => prev.filter(c => c.id !== marker.id));
            throw e; // Re-throw for caller to handle UI feedback if needed
        }
    }, [module]);

    const deleteCard = useCallback(async (id: string) => {
        setSavedCards(prev => prev.filter(c => c.id !== id));
        try {
            await api.deleteModuleCard(module, id);
        } catch (e) {
            console.error(`Failed to delete card from ${module}`, e);
            // Revert logic could go here (fetching again)
            const cards = await api.fetchModuleCards(module);
            setSavedCards(cards);
            throw e;
        }
    }, [module]);

    const updateCard = useCallback(async (id: string, updates: Partial<Marker>) => {
        setSavedCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        try {
            await api.updateModuleCard(module, id, updates);
        } catch (e) {
            console.error(`Failed to update card in ${module}`, e);
            // Could revert here too
            throw e;
        }
    }, [module]);

    return {
        savedCards,
        isLoading,
        saveCard,
        deleteCard,
        updateCard
    };
}
