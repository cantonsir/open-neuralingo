// Gemini TTS Service - Text-to-Speech using Gemini 2.5 Flash TTS

import { TTSResult, Subtitle } from '../types';
import { combineSubtitles, generateSubtitlesFromDuration, rescaleSubtitlesToDuration } from '../utils/subtitleGenerator';
import { analyzeAudioForSubtitles, getAudioDuration } from '../utils/audioAnalyzer';
import { getTtsLanguageCode } from '../utils/languageOptions';

export interface TTSOptions {
    text: string;
    voiceName?: string;
    stylePrompt?: string;
    languageCode?: string;
    ssmlGender?: SsmlGender;
}

type SsmlGender = 'MALE' | 'FEMALE' | 'NEUTRAL';

// Voice options from Gemini TTS
// Voice options from Gemini TTS / Cloud TTS (Chirp 3 HD)
// Both services support these voice names now (e.g. 'Kore', 'Charon')
export const VOICE_OPTIONS = [
    'Kore',    // Default

    'Charon',
    'Fenrir',
    'Aoede',
    'Puck',
    'Zephyr',
    'Orus',
    'Enceladus'
];

const ENGLISH_MULTI_VOICES = ['Kore', 'Orus', 'Enceladus'];
const MULTI_VOICE_GENDERS: SsmlGender[] = ['MALE', 'FEMALE', 'NEUTRAL'];

// User provided API Key for Cloud TTS (Chirp 3 HD)
// Loaded from .env.local
const CLOUD_TTS_API_KEY = import.meta.env.VITE_CLOUD_TTS_API_KEY;

interface VoiceConfig {
    voiceName?: string;
    ssmlGender?: SsmlGender;
}

function assignVoices(speakers: string[], ttsLanguageCode: string): Record<string, VoiceConfig> {
    const voiceMap: Record<string, VoiceConfig> = {};
    const isEnglish = ttsLanguageCode === 'en-US';
    speakers.forEach((speaker, index) => {
        if (isEnglish) {
            voiceMap[speaker] = { voiceName: ENGLISH_MULTI_VOICES[index % ENGLISH_MULTI_VOICES.length] };
        } else {
            voiceMap[speaker] = { ssmlGender: MULTI_VOICE_GENDERS[index % MULTI_VOICE_GENDERS.length] };
        }
    });
    return voiceMap;
}

async function requestCloudTtsAudio(
    text: string,
    ttsLanguageCode: string,
    voiceConfig: VoiceConfig = {}
): Promise<Blob> {
    if (!CLOUD_TTS_API_KEY) {
        throw new Error('Missing Cloud TTS API Key');
    }

    const voiceLabel = voiceConfig.voiceName || voiceConfig.ssmlGender || 'NEUTRAL';
    console.log('[Cloud TTS] Lang:', ttsLanguageCode, 'Voice:', voiceLabel, 'Text:', text.substring(0, 80));

    const voicePayload = voiceConfig.voiceName
        ? {
            languageCode: ttsLanguageCode,
            name: `${ttsLanguageCode}-Chirp3-HD-${voiceConfig.voiceName}`
        }
        : {
            languageCode: ttsLanguageCode,
            ssmlGender: voiceConfig.ssmlGender || 'NEUTRAL'
        };

    const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${CLOUD_TTS_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: voicePayload,
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

    const binaryString = atob(data.audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'audio/mp3' });
}

/**
 * Generate speech audio from text using Cloud TTS (Chirp 3 HD) first,
 * falling back to Gemini 2.5 Flash TTS if needed.
 * Returns TTSResult with audio URL and subtitles
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
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
async function generateCloudSpeech(options: TTSOptions): Promise<TTSResult> {
    const { text, voiceName = 'Kore' } = options;

    const ttsLanguageCode = getTtsLanguageCode(options.languageCode);
    const useNamedVoice = ttsLanguageCode === 'en-US' && !!voiceName;
    const voiceConfig: VoiceConfig = useNamedVoice
        ? { voiceName }
        : { ssmlGender: options.ssmlGender || 'NEUTRAL' };

    console.log('[Single Voice] Cloud TTS lang:', ttsLanguageCode, 'voice:', voiceConfig.voiceName || voiceConfig.ssmlGender);

    const blob = await requestCloudTtsAudio(text, ttsLanguageCode, voiceConfig);
    const audioUrl = URL.createObjectURL(blob);
    
    // For now, use duration-based estimation for Cloud TTS too
    // (Word-level timing requires additional API configuration)
    const audio = new Audio(audioUrl);
    await new Promise<void>((resolve) => {
        audio.addEventListener('loadedmetadata', () => resolve());
        audio.load();
    });
    
    const duration = audio.duration;
    const subtitles = generateSubtitlesFromDuration(text, duration, 'cloud-tts');

    return {
        audioUrl,
        duration,
        subtitles,
        source: 'cloud-tts',
        accuracy: 'duration-based'
    };
}

/**
 * Generate dialogue audio using Gemini 2.5 Flash TTS (Multi-speaker capable)
 */
export async function generateDialogue(text: string, voiceName: string = 'Aoede'): Promise<TTSResult> {
    console.log('[Single Voice] Gemini TTS voice:', voiceName);
    return await generateGeminiSpeech({ text, voiceName });
}

interface MultiVoiceOptions {
    pauseSeconds?: number;
    languageCode?: string;
}

export async function generateMultiVoiceDialogue(
    lines: Array<{ speaker: string; text: string }>,
    options: MultiVoiceOptions = {}
): Promise<TTSResult> {
    if (lines.length === 0) {
        throw new Error('No dialogue lines provided');
    }

    if (!CLOUD_TTS_API_KEY) {
        console.warn('Multi-voice requires Cloud TTS API key. Falling back to single voice.');
        const fallbackTranscript = lines.map(line => `${line.speaker}: ${line.text}`).join('\n');
        return await generateSpeech({ text: fallbackTranscript, voiceName: 'Kore', languageCode: options.languageCode });
    }

    const pauseSeconds = options.pauseSeconds ?? 0.35;
    const ttsLanguageCode = getTtsLanguageCode(options.languageCode);
    const speakers = Array.from(new Set(lines.map(line => line.speaker)));
    const voiceMap = assignVoices(speakers, ttsLanguageCode);

    const audioContext = new AudioContext();
    const audioBuffers: AudioBuffer[] = [];
    const subtitleArrays: Subtitle[][] = [];
    const segmentDurations: number[] = [];

    try {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const voiceConfig = voiceMap[line.speaker] || { ssmlGender: 'NEUTRAL' };
            console.log('[Multi-Voice] Lang:', ttsLanguageCode, 'Speaker:', line.speaker, 'Voice:', voiceConfig.voiceName || voiceConfig.ssmlGender);
            const audioBlob = await requestCloudTtsAudio(line.text, ttsLanguageCode, voiceConfig);
            const audioBuffer = await decodeBlobToAudioBuffer(audioBlob, audioContext);

            audioBuffers.push(audioBuffer);

            const lineDuration = audioBuffer.duration;
            subtitleArrays.push(generateSubtitlesFromDuration(line.text, lineDuration, `cloud-tts-${i}`));

            const pause = i < lines.length - 1 ? pauseSeconds : 0;
            segmentDurations.push(lineDuration + pause);
        }

        const combinedBuffer = concatAudioBuffers(audioContext, audioBuffers, pauseSeconds);
        const combinedBlob = audioBufferToWavBlob(combinedBuffer);
        const audioUrl = URL.createObjectURL(combinedBlob);

        return {
            audioUrl,
            duration: combinedBuffer.duration,
            subtitles: combineSubtitles(subtitleArrays, segmentDurations),
            source: 'cloud-tts',
            accuracy: 'duration-based'
        };
    } catch (error) {
        console.error('Multi-voice generation failed, falling back to single voice:', error);
        const fallbackTranscript = lines.map(line => `${line.speaker}: ${line.text}`).join('\n');
        return await generateSpeech({ text: fallbackTranscript, voiceName: 'Kore', languageCode: options.languageCode });
    } finally {
        await audioContext.close();
    }
}

async function decodeBlobToAudioBuffer(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

function concatAudioBuffers(
    audioContext: AudioContext,
    buffers: AudioBuffer[],
    pauseSeconds: number
): AudioBuffer {
    if (buffers.length === 0) {
        return audioContext.createBuffer(1, 1, audioContext.sampleRate);
    }

    const sampleRate = audioContext.sampleRate;
    const pauseSamples = Math.round(pauseSeconds * sampleRate);
    const numberOfChannels = Math.max(...buffers.map(buffer => buffer.numberOfChannels));
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0)
        + pauseSamples * Math.max(0, buffers.length - 1);

    const output = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);
    let offset = 0;

    buffers.forEach((buffer, index) => {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const outputData = output.getChannelData(channel);
            const inputData = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
            outputData.set(inputData, offset);
        }

        offset += buffer.length;
        if (index < buffers.length - 1) {
            offset += pauseSamples;
        }
    });

    return output;
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const fileSize = headerSize + dataSize - 8;

    const wavBuffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(wavBuffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            let sample = buffer.getChannelData(channel)[i];
            sample = Math.max(-1, Math.min(1, sample));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Generate speech audio from text using Gemini 2.5 Flash TTS
 * Returns TTSResult with audio URL and subtitles
 */
async function generateGeminiSpeech(options: TTSOptions): Promise<TTSResult> {
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
        
        // Generate subtitles using smart audio analysis
        try {
            const { subtitles, accuracy } = await analyzeAudioForSubtitles(
                audioUrl,
                sanitizedText,
                'gemini-tts',
                false
            );
            
            return {
                audioUrl,
                subtitles,
                source: 'gemini-tts',
                accuracy: accuracy as TTSResult['accuracy']
            };
        } catch (analysisError) {
            console.error('Audio analysis failed, using basic estimation:', analysisError);
            
            // Fallback: Basic estimation
            const estimatedDuration = sanitizedText.split(/\s+/).length / 2.5;
            
            return {
                audioUrl,
                subtitles: generateSubtitlesFromDuration(sanitizedText, estimatedDuration, 'gemini-tts'),
                source: 'gemini-tts',
                accuracy: 'estimated'
            };
        }

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

/**
 * Upgrade subtitles using timing rescale based on audio duration
 * Preserves existing subtitle segmentation while fixing drift
 */
export async function upgradeSubtitlesWithWebSpeech(
    videoId: string,
    audioUrl: string,
    currentSubtitles: Subtitle[]
): Promise<{ subtitles: Subtitle[]; accuracy: string }> {
    const duration = await getAudioDuration(audioUrl);
    const { subtitles, scale, changed } = rescaleSubtitlesToDuration(currentSubtitles, duration, {
        anchor: 'start',
        clampToDuration: true,
    });

    const accuracy = changed ? `rescaled (x${scale.toFixed(3)})` : 'no change';

    return { subtitles, accuracy };
}
