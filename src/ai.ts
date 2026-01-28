/// <reference types="vite/client" />
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
// Ensure you have VITE_GEMINI_API_KEY in your .env.local file
const getGenAI = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("VITE_GEMINI_API_KEY is missing via import.meta.env");
        return null;
    }
    return new GoogleGenerativeAI(apiKey);
};

// Normalize language codes for backward compatibility
const normalizeLanguageCode = (code: string): string => {
    // Handle legacy 'zh' code -> default to Simplified Chinese
    if (code === 'zh') return 'zh-CN';
    return code;
};

export const generateDefinition = async (
    text: string,
    context: string = "",
    targetLanguage: string = "en"
): Promise<string | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const languageNames: Record<string, string> = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
            'ja': 'Japanese', 'ko': 'Korean', 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese',
            'yue': 'Cantonese', 'pt': 'Portuguese', 'ru': 'Russian', 'it': 'Italian',
            'ar': 'Arabic', 'hi': 'Hindi'
        };

        const normalizedLang = normalizeLanguageCode(targetLanguage);

        let prompt = `Provide a concise, dictionary-like definition for the English word or phrase: "${text}".
        If it's a phrase, explain its idiomatic meaning.
        Keep it short (1-2 sentences).
        Respond in ${languageNames[normalizedLang] || 'English'}.`;

        if (context) {
            prompt += `\nContext: "${context}"`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating definition:", error);
        return null;
    }
};

export const generateSentenceMeaning = async (
    sentence: string,
    targetLanguage: string = "en"
): Promise<string | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const languageNames: Record<string, string> = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
            'ja': 'Japanese', 'ko': 'Korean', 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese',
            'yue': 'Cantonese', 'pt': 'Portuguese', 'ru': 'Russian', 'it': 'Italian',
            'ar': 'Arabic', 'hi': 'Hindi'
        };

        const prompt = `Translate this English sentence to ${languageNames[targetLanguage] || 'English'}. Provide a clear, natural translation.

Sentence: "${sentence}"

Keep it concise (1-2 sentences). If the sentence contains idioms or complex grammar, preserve the meaning in the translation.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating sentence meaning:", error);
        return null;
    }
};

export const generateBilingualDefinition = async (
    text: string,
    context: string = "",
    nativeLanguage: string = "en"
): Promise<string | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const languageNames: Record<string, string> = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
            'ja': 'Japanese', 'ko': 'Korean', 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese',
            'yue': 'Cantonese', 'pt': 'Portuguese', 'ru': 'Russian', 'it': 'Italian',
            'ar': 'Arabic', 'hi': 'Hindi'
        };

        const nativeLangName = languageNames[nativeLanguage] || 'English';

        let prompt = `Provide a bilingual definition for the English word or phrase: "${text}".

Format your response as a JSON object with these keys:
- "english": A brief English explanation (1 sentence)
- "native": The ${nativeLangName} translation and explanation

Return ONLY valid JSON. No markdown formatting.`;

        if (context) {
            prompt += `\n\nContext sentence: "${context}"`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating bilingual definition:", error);
        return null;
    }
};

export const generateStory = async (topic: string, level: string = "intermediate"): Promise<{ title: string; content: string } | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `Write a short, engaging story (approx. 150-200 words) for an English learner at usage level: ${level}.
        Topic: "${topic}".
        
        Return valid JSON in the following format:
        {
            "title": "Story Title",
            "content": "Story content goes here..."
        }
        Do not use markdown code blocks. Just raw JSON.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error generating story:", error);
        return null;
    }
};

export const getChatResponse = async (history: { role: 'user' | 'model'; parts: string }[], scenario: string): Promise<string | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{
                        text: `You are a helpful roleplay partner for an English learner. 
                    Scenario: ${scenario}. 
                    Keep your responses concise, natural, and encouraging. 
                    Do not break character unless asked for feedback.` }],
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I'm ready to roleplay this scenario with you." }],
                },
                // Transform our simpler history format to Gemini's format
                ...history.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.parts }]
                }))
            ],
            generationConfig: {
                maxOutputTokens: 150,
            },
        });

        const result = await chat.sendMessage("Continue conversation");
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating chat response:", error);
        return null;
    }
};

export const correctWriting = async (text: string, instruction: string = "Fix grammar and improve flow"): Promise<string | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `Act as an expert English teacher.
        Task: ${instruction} for the following text.
        Text: "${text}"
        
        Provide the corrected version first, followed by a brief bulleted list of key changes/explanations.
        Format cleanly with markdown.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error correcting writing:", error);
        return null;
    }
};
