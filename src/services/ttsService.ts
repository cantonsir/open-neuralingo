// Gemini TTS Service - Text-to-Speech using Gemini 2.5 Flash TTS

export interface TTSOptions {
    text: string;
    voiceName?: string;
    stylePrompt?: string;
}

// Voice options from Gemini TTS
// Voice options from Gemini TTS / Cloud TTS (Chirp 3 HD)
// Both services support these voice names now (e.g. 'Kore', 'Charon')
export const VOICE_OPTIONS = [
    'Kore',    // Default

    'Charon',
    'Fenrir',
    'Aoede',
    'Puck',
    'Zephyr'
];

// User provided API Key for Cloud TTS (Chirp 3 HD)
// Loaded from .env.local
const CLOUD_TTS_API_KEY = import.meta.env.VITE_CLOUD_TTS_API_KEY;

/**
 * Generate speech audio from text using Cloud TTS (Chirp 3 HD) first,
 * falling back to Gemini 2.5 Flash TTS if needed.
 * Returns a blob URL that can be played in an audio element
 */
export async function generateSpeech(options: TTSOptions): Promise<string> {
    // 1. Try Google Cloud TTS (Chirp 3 HD)
    try {
        // console.log('Attempting Cloud TTS (Chirp 3 HD)...', options.text.substring(0, 20) + '...');
        return await generateCloudSpeech(options);
    } catch (cloudError) {
        console.warn('Cloud TTS failed, falling back to Gemini TTS:', cloudError);

        // 2. Fallback to Gemini 2.5 Flash TTS
        return await generateGeminiSpeech(options);
    }
}

/**
 * Generate speech using Google Cloud Text-to-Speech API (Chirp 3 HD)
 */
async function generateCloudSpeech(options: TTSOptions): Promise<string> {
    const { text, voiceName = 'Kore' } = options;

    if (!CLOUD_TTS_API_KEY) {
        throw new Error('Missing Cloud TTS API Key');
    }

    const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${CLOUD_TTS_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: {
                    languageCode: 'en-US',
                    // Construct the full Chirp 3 HD voice ID (e.g. 'en-US-Chirp3-HD-Kore')
                    name: `en-US-Chirp3-HD-${voiceName}`
                },
                audioConfig: {
                    audioEncoding: 'MP3'
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloud TTS API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.audioContent) {
        throw new Error('No audio content in Cloud TTS response');
    }

    // Convert base64 MP3 to Blob URL
    const binaryString = atob(data.audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mp3' });
    return URL.createObjectURL(blob);
}

/**
 * Generate dialogue audio using Gemini 2.5 Flash TTS (Multi-speaker capable)
 * This bypasses Cloud TTS as it requires model inference for speaker changes.
 */
export async function generateDialogue(text: string, voiceName: string = 'Aoede'): Promise<string> {
    return await generateGeminiSpeech({ text, voiceName });
}

/**
 * Generate speech audio from text using Gemini 2.5 Flash TTS

 * Returns a blob URL that can be played in an audio element
 */
async function generateGeminiSpeech(options: TTSOptions): Promise<string> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing VITE_GEMINI_API_KEY');
    }

    const { text, voiceName = 'Kore' } = options;

    // Sanitize text: Remove markdown characters that might be spoken or confuse TTS
    const sanitizedText = text
        .replace(/[*_`~]/g, '') // Remove * _ ` ~
        .replace(/\[.*?\]/g, '') // Remove [text in brackets]
        .replace(/\(.*?\)/g, '') // Remove (text in parens) - optional, but good precaution
        .trim();

    // Debug: Log exactly what we're sending to TTS
    console.log('TTS Request - Original:', text);
    console.log('TTS Request - Sanitized:', sanitizedText);

    // NOTE: The text is spoken directly. Style prompts like "Say clearly:" 
    // were being spoken aloud as part of the audio, causing mismatch with transcript.
    // For now, we just pass the text directly without style modifications.

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: sanitizedText }]
                    }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: voiceName
                                }
                            }
                        }
                    }
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`TTS API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Audio) {
            throw new Error('No audio data in response');
        }

        // Convert base64 PCM to WAV and create blob URL
        const audioUrl = pcmToWavBlobUrl(base64Audio);
        return audioUrl;

    } catch (error) {
        console.error('Gemini TTS error:', error);
        throw error;
    }
}

/**
 * Convert base64 PCM audio to WAV format and return a blob URL
 * Gemini TTS returns: s16le (signed 16-bit little-endian), 24kHz, mono
 */
function pcmToWavBlobUrl(base64Pcm: string): string {
    // Decode base64 to binary
    const binaryString = atob(base64Pcm);
    const pcmData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        pcmData[i] = binaryString.charCodeAt(i);
    }

    // WAV header parameters
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize - 8;

    // Create WAV file buffer
    const wavBuffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(wavBuffer);

    // Write WAV header
    // RIFF chunk
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);  // fmt chunk size
    view.setUint16(20, 1, true);   // audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    const wavData = new Uint8Array(wavBuffer);
    wavData.set(pcmData, headerSize);

    // Create blob and URL
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

/**
 * Revoke a blob URL to free memory
 */
export function revokeAudioUrl(url: string): void {
    URL.revokeObjectURL(url);
}
