import { useState, useEffect } from 'react';

export function useTargetLanguage() {
  const [targetLanguage, setTargetLanguage] = useState<string>(() => {
    return localStorage.getItem('targetLanguage') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('targetLanguage', targetLanguage);
  }, [targetLanguage]);

  return { targetLanguage, setTargetLanguage };
}
