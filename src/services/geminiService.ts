// Gemini AI Service for generating personalized test sentences

interface AssessmentResult {
    targetLanguage: string;
    targetContent: string;
    listeningLevel: number;
    subtitleDependence: number;
    difficulties: string[];
}

export interface TestSentence {
    id: number;
    sentence: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

const contentTypeLabels: Record<string, string> = {
    anime: 'anime and animated shows',
    movies: 'movies and TV dramas',
    daily: 'everyday conversations',
    academic: 'academic lectures and presentations',
    news: 'news broadcasts and interviews',
    other: 'general media content',
};

const difficultyLabels: Record<string, string> = {
    vocabulary: 'insufficient vocabulary',
    speed: 'fast speech rate',
    linking: 'word linking and weak forms',
    accent: 'accent variations',
    noise: 'background noise',
    multi: 'multiple speakers',
};

const languageLabels: Record<string, string> = {
    en: 'English',
    ja: 'Japanese',
    'zh-HK': 'Cantonese',
    'zh-CN': 'Mandarin Chinese',
    de: 'German',
};

function buildPrompt(assessment: AssessmentResult): string {
    const language = languageLabels[assessment.targetLanguage] || 'English';
    const content = contentTypeLabels[assessment.targetContent] || 'general content';
    const level = assessment.listeningLevel;
    const difficulties = assessment.difficulties.map(d => difficultyLabels[d] || d).join(' and ');

    return `You are a language learning expert. Generate exactly 10 ${language} listening practice sentences for a learner.

Learner Profile:
- Target content: ${content}
- Listening level: ${level}/5 (0=beginner, 5=advanced)
- Main difficulties: ${difficulties || 'general listening comprehension'}

Sentence Requirements based on level ${level}:
${level <= 1 ? '- Very short sentences (4-6 words)\n- Basic, high-frequency vocabulary\n- Clear, simple grammar' : ''}
${level === 2 ? '- Short sentences (6-8 words)\n- Common vocabulary with some variety\n- Simple sentence structures' : ''}
${level === 3 ? '- Medium sentences (8-10 words)\n- Natural vocabulary from ${content}\n- Some idiomatic expressions' : ''}
${level >= 4 ? '- Longer sentences (10-15 words)\n- Natural speech patterns with contractions\n- Include linking sounds and reduced forms' : ''}

Content theme: Create sentences that would naturally appear in ${content}.

IMPORTANT: Return ONLY a valid JSON array with exactly 10 objects. No markdown, no explanation.
Format: [{"id": 1, "sentence": "...", "difficulty": "easy|medium|hard"}, ...]`;
}

export async function generateTestSentences(assessment: AssessmentResult): Promise<TestSentence[]> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        console.error('Missing VITE_GEMINI_API_KEY');
        return getFallbackSentences(assessment.listeningLevel);
    }

    const prompt = buildPrompt(assessment);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response (handle possible markdown wrapping)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('No JSON array found in response');
        }

        const sentences: TestSentence[] = JSON.parse(jsonMatch[0]);
        return sentences.slice(0, 10);
    } catch (error) {
        console.error('Gemini API error:', error);
        return getFallbackSentences(assessment.listeningLevel);
    }
}

// Fallback sentences if API fails
function getFallbackSentences(level: number): TestSentence[] {
    const easy: TestSentence[] = [
        { id: 1, sentence: "Hello, how are you today?", difficulty: 'easy' },
        { id: 2, sentence: "I like to watch movies.", difficulty: 'easy' },
        { id: 3, sentence: "The weather is nice today.", difficulty: 'easy' },
        { id: 4, sentence: "Can you help me please?", difficulty: 'easy' },
        { id: 5, sentence: "I went to the store yesterday.", difficulty: 'easy' },
    ];

    const medium: TestSentence[] = [
        { id: 6, sentence: "I've been meaning to call you about the meeting.", difficulty: 'medium' },
        { id: 7, sentence: "Would you mind if I opened the window a bit?", difficulty: 'medium' },
        { id: 8, sentence: "She said she'd be here by five o'clock.", difficulty: 'medium' },
        { id: 9, sentence: "I'm not sure what he meant by that comment.", difficulty: 'medium' },
        { id: 10, sentence: "They're gonna have to reschedule the event.", difficulty: 'medium' },
    ];

    const hard: TestSentence[] = [
        { id: 1, sentence: "I wouldn't've thought that was possible if I hadn't seen it myself.", difficulty: 'hard' },
        { id: 2, sentence: "You know what I mean when I say it's kinda complicated.", difficulty: 'hard' },
        { id: 3, sentence: "She's gotta be the most talented person I've ever worked with.", difficulty: 'hard' },
        { id: 4, sentence: "Lemme know if you wanna grab coffee sometime next week.", difficulty: 'hard' },
        { id: 5, sentence: "I dunno why they'd wanna do something like that.", difficulty: 'hard' },
    ];

    if (level <= 2) return [...easy, ...medium.slice(0, 5)];
    if (level <= 4) return [...easy.slice(0, 3), ...medium, ...hard.slice(0, 2)];
    return [...medium.slice(0, 3), ...hard, ...easy.slice(0, 2)];
}

// ===== AI ANALYSIS OF LISTENING RESULTS =====

export interface TestResult {
    sentence: string;
    understood: boolean;
    replays: number;
    reactionTimeMs: number;
    markedWordIndices: number[];
}

export interface ListeningAnalysis {
    overallLevel: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    summary: string;
}

export async function analyzeListeningResults(results: TestResult[]): Promise<ListeningAnalysis> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        return getDefaultAnalysis(results);
    }

    // Build analysis prompt
    const totalReplays = results.reduce((sum, r) => sum + r.replays, 0);
    const avgReactionTime = results.reduce((sum, r) => sum + r.reactionTimeMs, 0) / results.length;
    const understoodCount = results.filter(r => r.understood).length;
    const markedWords = results.flatMap((r, i) =>
        r.markedWordIndices.map(idx => {
            const words = r.sentence.split(' ');
            return words[idx] || '';
        })
    ).filter(w => w);

    const prompt = `You are an expert language learning analyst. Analyze this listening test performance:

TEST RESULTS (10 questions):
- Understood clearly: ${understoodCount}/10
- Total replays needed: ${totalReplays}
- Average reaction time: ${Math.round(avgReactionTime)}ms
- Words user couldn't catch: ${markedWords.join(', ') || 'none'}

SENTENCES TESTED:
${results.map((r, i) => `${i + 1}. "${r.sentence}" - ${r.understood ? 'Understood' : 'Struggled'}, ${r.replays} replays, marked: ${r.markedWordIndices.length} words`).join('\n')}

Based on this data, provide a listening ability analysis. Return ONLY valid JSON:
{
  "overallLevel": "beginner|intermediate|advanced",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"], 
  "recommendations": ["tip1", "tip2", "tip3"],
  "summary": "2-3 sentence summary of their listening ability"
}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.5,
                        maxOutputTokens: 1024,
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        return JSON.parse(jsonMatch[0]) as ListeningAnalysis;
    } catch (error) {
        console.error('Analysis API error:', error);
        return getDefaultAnalysis(results);
    }
}

function getDefaultAnalysis(results: TestResult[]): ListeningAnalysis {
    const understoodCount = results.filter(r => r.understood).length;
    const level = understoodCount >= 8 ? 'advanced' : understoodCount >= 5 ? 'intermediate' : 'beginner';

    return {
        overallLevel: level,
        strengths: ['Completed the assessment'],
        weaknesses: understoodCount < 5 ? ['Needs more listening practice'] : [],
        recommendations: [
            'Practice with native audio daily',
            'Focus on common contractions and linking',
            'Try shadowing exercises'
        ],
        summary: `You understood ${understoodCount}/10 sentences. Keep practicing to improve your listening comprehension!`
    };
}

