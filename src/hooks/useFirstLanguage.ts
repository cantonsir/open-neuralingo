import { useState, useEffect } from 'react';

export function useFirstLanguage() {
    const [firstLanguage, setFirstLanguage] = useState<string>(() => {
        return localStorage.getItem('firstLanguage') || 'en';
    });

    useEffect(() => {
        localStorage.setItem('firstLanguage', firstLanguage);
    }, [firstLanguage]);

    return { firstLanguage, setFirstLanguage };
}
