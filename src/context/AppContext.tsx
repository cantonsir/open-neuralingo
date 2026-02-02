/**
 * AppContext provides global application state for theme, language, navigation, and settings.
 * 
 * Usage:
 * - Import `useApp` hook in child components to access shared state
 * - The context is wrapped around the App in main.tsx via AppProvider
 * 
 * Note: App.tsx currently manages its own state for backwards compatibility.
 * Child components can progressively adopt useApp() for shared state access.
 */
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Module, View, Theme } from '../types';
import { useTheme } from '../hooks/useTheme';
import { useTargetLanguage } from '../hooks/useTargetLanguage';

interface AppContextValue {
  // Theme
  theme: Theme;
  toggleTheme: () => void;
  
  // Language
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
  
  // Module navigation
  activeModule: Module;
  setActiveModule: (module: Module) => void;
  
  // View navigation
  view: View;
  setView: (view: View) => void;
  
  // Settings
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const { theme, toggleTheme } = useTheme();
  const { targetLanguage, setTargetLanguage } = useTargetLanguage();
  
  const [activeModule, setActiveModule] = useState<Module>('landing');
  const [view, setView] = useState<View>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const value: AppContextValue = {
    theme,
    toggleTheme,
    targetLanguage,
    setTargetLanguage,
    activeModule,
    setActiveModule,
    view,
    setView,
    isSettingsOpen,
    setIsSettingsOpen,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
