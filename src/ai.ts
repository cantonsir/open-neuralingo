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
- "pronunciation": IPA phonetic transcription (e.g., "/rɪˈmɑːrkəbl/")
- "english": A brief English explanation (1-2 sentences, include the part of speech)
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

const isSubtitleLikeText = (text: string): boolean => {
    const normalized = text.replace(/\r\n/g, '\n');
    const dashTurns = (normalized.match(/\s-\s/g) || []).length;
    const cueTags = (normalized.match(/\((?:audience|laugh|applause|music|cheering|sighs?|gasps?|groans?)\b[^)]*\)/gi) || []).length;
    const shortLines = normalized.split('\n').filter((line) => line.trim().length > 0 && line.trim().length <= 80).length;

    return dashTurns >= 4 || cueTags >= 3 || shortLines >= 8;
};

const prepareSubtitleReadableInput = (text: string): string => {
    return text
        .replace(/\r\n/g, '\n')
        // Split inline subtitle turn separators into readable turn lines.
        .replace(/\s+-\s+/g, '\n- ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export const generateReadableText = async (text: string): Promise<string | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    const input = text.trim();
    if (!input) return text;

    const subtitleLike = isSubtitleLikeText(input);
    const preparedInput = subtitleLike ? prepareSubtitleReadableInput(input) : input;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = subtitleLike
            ? `Reformat the following subtitle transcript to be easier to read while preserving context flow.
The source is TV/video subtitle text with rapid dialogue turns and reaction cues.
Keep the exact wording, punctuation, symbols, and order.
Do NOT paraphrase, summarize, translate, correct grammar, or add headings.
Do NOT add or remove any words.
Only adjust line breaks and blank lines.

Formatting rules:
1) Keep each sentence intact. Never split one sentence across lines.
2) Start each dialogue turn on a new line when a "- " turn marker appears.
3) Group related turns into short paragraphs (2-5 turns) so reading flow feels natural.
4) Keep reaction cues like "(audience laughing)" attached to their nearest line; do not isolate them repeatedly.
5) Keep existing list markers/bullets as-is.
6) Preserve all non-newline characters exactly; only newline placement may change.

Return plain text only.

Text:
"""
${preparedInput}
"""`
            : `Reformat the following text to be easier to read while preserving context flow.
Keep the exact wording, punctuation, symbols, and order.
Do NOT paraphrase, summarize, translate, correct grammar, or add headings.
Do NOT add or remove any words.
Only adjust line breaks and blank lines.

Formatting rules:
1) Keep each sentence intact. Never split one sentence across lines.
2) Group related sentences by meaning/topic flow into short paragraphs.
3) Prefer 2-4 related sentences per paragraph when natural; avoid one short sentence per line.
4) If dialogue markers like " - " exist, keep turns readable but avoid overly short one-line fragments unless necessary.
5) Keep existing list markers/bullets as-is.
6) Preserve all non-newline characters exactly; only newline placement may change.

Return plain text only.

Text:
"""
${preparedInput}
"""`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating readable text:", error);
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
