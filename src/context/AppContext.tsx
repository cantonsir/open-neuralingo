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
  
  const [activeModule, setActiveModule] = useState<Module>('listening');
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
