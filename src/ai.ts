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

export const generateDefinition = async (text: string, context: string = ""): Promise<string | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        let prompt = `Provide a concise, dictionary-like definition for the English word or phrase: "${text}". 
        If it's a phrase, explain its idiomatic meaning.
        Keep it short (1-2 sentences).`;

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
