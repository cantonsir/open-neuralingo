export interface FocusAnnotation {
    id: string;
    type: 'word' | 'phrase' | 'sentence';
    text: string;
    sentenceContext: string;
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
    createdAt: number;
}

export interface FocusReadingAnalysis {
    overallLevel: number;
    vocabularyLevel: number;
    grammarLevel: number;
    primaryBarrier: 'vocabulary' | 'grammar' | 'balanced';
    flaggedWords: Array<{
        word: string;
        difficulty: 'basic' | 'intermediate' | 'advanced';
        definition?: {
            pronunciation?: string;
            english?: string;
            native?: string;
        };
    }>;
    flaggedPhrases: Array<{
        phrase: string;
        definition?: {
            english?: string;
            native?: string;
        };
    }>;
    flaggedSentences: Array<{
        text: string;
        grammarPattern?: string;
        complexity: 'moderate' | 'high' | 'very_high';
        explanation?: string;
    }>;
    strengths: string[];
    weaknesses: string[];
    recommendations: {
        focusAreas: string[];
        suggestedPractice: string[];
        nextSteps: string[];
    };
    summary: string;
    statistics: {
        totalAnnotations: number;
        wordAnnotations: number;
        phraseAnnotations: number;
        sentenceAnnotations: number;
    };
}

export function classifyAnnotationType(
    selectedText: string,
    fullParagraphText: string
): 'word' | 'phrase' | 'sentence' {
    const trimmed = selectedText.trim();
    const wordCount = trimmed.split(/\s+/).length;

    // Check if the selection matches a full sentence in the paragraph
    const sentences = fullParagraphText.match(/[^.!?]+[.!?]+/g) || [fullParagraphText];
    const isFullSentence = sentences.some(
        (s) => s.trim() === trimmed || trimmed.includes(s.trim())
    );

    if (isFullSentence && wordCount > 3) return 'sentence';
    if (wordCount === 1) return 'word';
    return 'phrase';
}

export const analyzeFocusReadingBehavior = async (
    contentText: string,
    annotations: FocusAnnotation[],
    firstLanguage = 'en'
): Promise<FocusReadingAnalysis> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    const wordAnnotations = annotations.filter((a) => a.type === 'word');
    const phraseAnnotations = annotations.filter((a) => a.type === 'phrase');
    const sentenceAnnotations = annotations.filter((a) => a.type === 'sentence');

    const statistics = {
        totalAnnotations: annotations.length,
        wordAnnotations: wordAnnotations.length,
        phraseAnnotations: phraseAnnotations.length,
        sentenceAnnotations: sentenceAnnotations.length,
    };

    const defaultAnalysis: FocusReadingAnalysis = {
        overallLevel: 3,
        vocabularyLevel: 3,
        grammarLevel: 3,
        primaryBarrier: wordAnnotations.length > sentenceAnnotations.length ? 'vocabulary' : 'balanced',
        flaggedWords: wordAnnotations.map((a) => ({
            word: a.text,
            difficulty: 'intermediate' as const,
        })),
        flaggedPhrases: phraseAnnotations.map((a) => ({
            phrase: a.text,
        })),
        flaggedSentences: sentenceAnnotations.map((a) => ({
            text: a.text,
            complexity: 'moderate' as const,
        })),
        strengths: [],
        weaknesses: [],
        recommendations: {
            focusAreas: ['Continue reading with focus mode'],
            suggestedPractice: ['Review marked words and phrases'],
            nextSteps: ['Complete another focus reading session'],
        },
        summary: 'Assessment based on your reading annotations.',
        statistics,
    };

    if (!apiKey || annotations.length === 0) {
        return defaultAnalysis;
    }

    const prompt = `You are an expert language learning analyst. A learner read a text and annotated parts they did not understand. Analyze their annotations to assess reading level and provide feedback.

## Full Content
${contentText}

## Learner's preferred language for explanations: ${firstLanguage}

## Annotated Words (vocabulary the learner does not know) - marked in RED
${wordAnnotations.length > 0
    ? wordAnnotations.map((a, i) => `${i + 1}. "${a.text}" -- context: "${a.sentenceContext.substring(0, 150)}"`).join('\n')
    : '(none)'}

## Annotated Phrases (multi-word expressions the learner does not understand) - marked in GREEN
${phraseAnnotations.length > 0
    ? phraseAnnotations.map((a, i) => `${i + 1}. "${a.text}" -- context: "${a.sentenceContext.substring(0, 150)}"`).join('\n')
    : '(none)'}

## Annotated Sentences (full sentences the learner does not comprehend) - marked with UNDERSCORE
${sentenceAnnotations.length > 0
    ? sentenceAnnotations.map((a, i) => `${i + 1}. "${a.text.substring(0, 200)}"`).join('\n')
    : '(none)'}

## Analysis Tasks
1. For each annotated word, classify its difficulty (basic/intermediate/advanced) and provide a bilingual definition with:
   - pronunciation (IPA)
   - english explanation (1-2 sentences)
   - native language explanation (${firstLanguage})
2. For each annotated phrase, provide a bilingual explanation with:
   - english explanation (1-2 sentences)
   - native language explanation (${firstLanguage})
3. For each annotated sentence, identify the grammar pattern that makes it difficult and explain in the learner's language.
4. Assess overall reading comprehension level (1-5 scale).
5. Determine whether the primary barrier is vocabulary, grammar, or balanced.
6. Provide strengths, weaknesses, and specific recommendations.
7. Write a 2-3 sentence summary.

Return ONLY valid JSON:
{
  "overallLevel": 3,
  "vocabularyLevel": 3,
  "grammarLevel": 3,
  "primaryBarrier": "vocabulary",
  "flaggedWords": [
    { "word": "ephemeral", "difficulty": "advanced", "definition": { "pronunciation": "/ɪˈfɛmərəl/", "english": "...", "native": "..." } }
  ],
  "flaggedPhrases": [
    { "phrase": "in light of", "definition": { "english": "...", "native": "..." } }
  ],
  "flaggedSentences": [
    { "text": "Despite the...", "grammarPattern": "concessive clause", "complexity": "high", "explanation": "..." }
  ],
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendations": {
    "focusAreas": ["..."],
    "suggestedPractice": ["..."],
    "nextSteps": ["..."]
  },
  "summary": "..."
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
                        temperature: 0.4,
                        maxOutputTokens: 3072,
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        const ai = JSON.parse(jsonMatch[0]);

        const mappedWords = Array.isArray(ai.flaggedWords)
            ? ai.flaggedWords.map((word: any) => ({
                word: word.word || '',
                difficulty: word.difficulty || 'intermediate',
                definition: word.definition
                    ? {
                        pronunciation: word.definition.pronunciation,
                        english: word.definition.english,
                        native: word.definition.native,
                    }
                    : word.suggestedDefinition
                        ? { native: word.suggestedDefinition }
                        : undefined,
            }))
            : defaultAnalysis.flaggedWords;

        const mappedPhrases = Array.isArray(ai.flaggedPhrases)
            ? ai.flaggedPhrases.map((phrase: any) => ({
                phrase: phrase.phrase || '',
                definition: phrase.definition
                    ? {
                        english: phrase.definition.english,
                        native: phrase.definition.native,
                    }
                    : phrase.explanation
                        ? { native: phrase.explanation }
                        : undefined,
            }))
            : defaultAnalysis.flaggedPhrases;

        return {
            overallLevel: ai.overallLevel || defaultAnalysis.overallLevel,
            vocabularyLevel: ai.vocabularyLevel || defaultAnalysis.vocabularyLevel,
            grammarLevel: ai.grammarLevel || defaultAnalysis.grammarLevel,
            primaryBarrier: ai.primaryBarrier || defaultAnalysis.primaryBarrier,
            flaggedWords: mappedWords,
            flaggedPhrases: mappedPhrases,
            flaggedSentences: ai.flaggedSentences || defaultAnalysis.flaggedSentences,
            strengths: ai.strengths || defaultAnalysis.strengths,
            weaknesses: ai.weaknesses || defaultAnalysis.weaknesses,
            recommendations: ai.recommendations || defaultAnalysis.recommendations,
            summary: ai.summary || defaultAnalysis.summary,
            statistics,
        };
    } catch (error) {
        console.error('Focus reading analysis error:', error);
        return defaultAnalysis;
    }
};
