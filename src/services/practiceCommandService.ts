/**
 * Practice Command Service
 *
 * Handles slash commands for the Practice Generator:
 * - /plan [prompt]: Preview generation strategy before creating dialogue
 * - /fast: Toggle Fast Mode for quicker generation
 */

// ===== TYPES =====

export type CommandType = 'plan' | 'fast' | 'none';

export interface ParsedCommand {
    type: CommandType;
    args: string;
    originalText: string;
}

export interface GenerationPlan {
    speakers: {
        count: number;
        roles: string[];
    };
    estimatedDuration: string;
    vocabularyCoverage: {
        used: string[];
        total: number;
        percentage: number;
    };
    patternsUsed: string[];
    setting: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    summary: string;
}

export interface PracticeContext {
    vocabulary: string[];
    patterns: string[];
    videoTranscript?: string;
    pdfContent?: string;
    description?: string;
}

export interface FastModeResult {
    mode: boolean;
    message: string;
}

// ===== COMMAND PARSING =====

/**
 * Parse user input to detect slash commands.
 * Returns the command type, arguments, and original text.
 */
export function parseCommand(input: string): ParsedCommand {
    const trimmed = input.trim();

    // Check for /plan command
    if (trimmed.startsWith('/plan')) {
        const args = trimmed.slice(5).trim(); // Remove '/plan' prefix
        return {
            type: 'plan',
            args,
            originalText: trimmed
        };
    }

    // Check for /fast command
    if (trimmed === '/fast' || trimmed.startsWith('/fast ')) {
        return {
            type: 'fast',
            args: '',
            originalText: trimmed
        };
    }

    // No command detected
    return {
        type: 'none',
        args: '',
        originalText: trimmed
    };
}

/**
 * Check if input starts with a slash (potential command).
 */
export function isCommandPrefix(input: string): boolean {
    return input.trim().startsWith('/');
}

/**
 * Get available commands for autocomplete.
 */
export function getAvailableCommands(): { command: string; description: string }[] {
    return [
        { command: '/plan', description: 'Preview generation plan before creating dialogue' },
        { command: '/fast', description: 'Toggle Fast Mode for quicker generation' }
    ];
}

/**
 * Get command suggestions based on partial input.
 */
export function getCommandSuggestions(partialInput: string): { command: string; description: string }[] {
    const input = partialInput.trim().toLowerCase();
    if (!input.startsWith('/')) return [];

    return getAvailableCommands().filter(cmd =>
        cmd.command.toLowerCase().startsWith(input)
    );
}

// ===== COMMAND HANDLERS =====

/**
 * Handle /fast command - toggles Fast Mode.
 */
export function handleFastCommand(currentMode: boolean): FastModeResult {
    const newMode = !currentMode;

    return {
        mode: newMode,
        message: newMode
            ? '⚡ Fast Mode enabled - Using faster model for quicker generation'
            : '✓ Standard Mode - Using higher quality model'
    };
}

/**
 * Handle /plan command - generates a preview plan before actual dialogue generation.
 * This calls the Gemini API to analyze the prompt and return a structured plan.
 */
export async function handlePlanCommand(
    prompt: string,
    vocabulary: string[],
    patterns: string[],
    context: PracticeContext,
    isFastMode: boolean = false
): Promise<GenerationPlan> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Gemini API key not configured');
    }

    // Use faster model for plan generation since it's just analysis
    const model = isFastMode ? 'gemini-2.0-flash-lite' : 'gemini-2.0-flash';

    const vocabList = vocabulary.length > 0 ? vocabulary.join(', ') : 'general vocabulary';
    const patternList = patterns.length > 0 ? patterns.join(', ') : 'natural speech patterns';

    let contextInfo = '';
    if (context.videoTranscript) {
        contextInfo += `\nVideo context available: ${context.videoTranscript.slice(0, 200)}...`;
    }
    if (context.pdfContent) {
        contextInfo += `\nDocument context available: ${context.pdfContent.slice(0, 200)}...`;
    }

    const systemPrompt = `Analyze this dialogue generation request and create a detailed plan.

USER PROMPT: "${prompt}"

AVAILABLE VOCABULARY (${vocabulary.length} words): ${vocabList}
PATTERNS TO PRACTICE: ${patternList}
${contextInfo}

Create a generation plan. Return ONLY valid JSON in this exact format:
{
    "speakers": {
        "count": 2,
        "roles": ["Customer", "Waiter"]
    },
    "estimatedDuration": "~2 minutes",
    "vocabularyCoverage": {
        "used": ["word1", "word2"],
        "total": ${vocabulary.length},
        "percentage": 80
    },
    "patternsUsed": ["pattern1", "pattern2"],
    "setting": "Restaurant scene during lunch",
    "difficulty": "intermediate",
    "summary": "A friendly conversation between a customer and waiter ordering lunch"
}

Rules:
- speakers.count: 2-3 speakers
- speakers.roles: Descriptive role names that fit the scenario
- estimatedDuration: Should be "~2 minutes" for standard dialogues
- vocabularyCoverage.used: List vocabulary words that will naturally fit the scenario
- vocabularyCoverage.percentage: Realistic percentage (60-90% typical)
- difficulty: "beginner", "intermediate", or "advanced"
- summary: One sentence description of the planned dialogue

Return ONLY the JSON, no markdown or explanation.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                        maxOutputTokens: 1024,
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const textRes = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract JSON from response
        const jsonMatch = textRes.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse plan response');
        }

        const plan = JSON.parse(jsonMatch[0]) as GenerationPlan;

        // Validate required fields
        if (!plan.speakers || !plan.estimatedDuration || !plan.setting) {
            throw new Error('Invalid plan structure');
        }

        return plan;
    } catch (error) {
        console.error('Plan generation error:', error);

        // Return a default plan on error
        return {
            speakers: {
                count: 2,
                roles: ['Person A', 'Person B']
            },
            estimatedDuration: '~2 minutes',
            vocabularyCoverage: {
                used: vocabulary.slice(0, Math.min(vocabulary.length, 8)),
                total: vocabulary.length,
                percentage: vocabulary.length > 0 ? Math.round((Math.min(8, vocabulary.length) / vocabulary.length) * 100) : 0
            },
            patternsUsed: patterns,
            setting: prompt || 'General conversation',
            difficulty: 'intermediate',
            summary: `A dialogue based on: ${prompt || 'the lesson content'}`
        };
    }
}

// ===== COMMAND EXECUTION =====

export interface CommandResult {
    type: 'plan' | 'mode_toggle' | 'error';
    data: GenerationPlan | FastModeResult | { message: string };
}

/**
 * Execute a parsed command and return the result.
 */
export async function executeCommand(
    command: ParsedCommand,
    context: PracticeContext,
    currentFastMode: boolean
): Promise<CommandResult> {
    switch (command.type) {
        case 'plan':
            try {
                const plan = await handlePlanCommand(
                    command.args,
                    context.vocabulary,
                    context.patterns,
                    context,
                    currentFastMode
                );
                return { type: 'plan', data: plan };
            } catch (error) {
                return {
                    type: 'error',
                    data: { message: `Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}` }
                };
            }

        case 'fast':
            const result = handleFastCommand(currentFastMode);
            return { type: 'mode_toggle', data: result };

        default:
            return {
                type: 'error',
                data: { message: `Unknown command: ${command.originalText}. Available: /plan, /fast` }
            };
    }
}
