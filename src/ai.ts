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

export const generateStory = async (topic: string, level: string = "intermediate"): Promise<{ title: string; content: string } | null> => {
    const genAI = getGenAI();
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
