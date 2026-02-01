/**
 * Subtitle Generation Service
 * 
 * Handles AI-powered subtitle generation using Google Speech-to-Text
 * with AssemblyAI fallback
 */

import { Subtitle } from '../types';

const API_BASE = '/api';

export interface GeneratedSubtitleResponse {
  subtitles: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
  language: string;
  source: string;
  cached: boolean;
}

export interface SubtitleStatusResponse {
  exists: boolean;
  language?: string;
  source?: string;
  generatedAt?: number;
  subtitleCount?: number;
}

export interface SubtitleConfigStatus {
  googleSpeech: {
    libraryInstalled: boolean;
    credentialsSet: boolean;
    credentialsPath: string | null;
    status: string;
  };
  gcs: {
    libraryInstalled: boolean;
    bucketSet: boolean;
    bucketName: string | null;
    status: string;
  };
  assemblyai: {
    apiKeySet: boolean;
    status: string;
  };
  ytdlp: {
    available: boolean;
    version: string | null;
    status: string;
  };
  ffmpeg: {
    available: boolean;
    version: string | null;
    status: string;
  };
  overallStatus: 'ready' | 'partial_missing_bucket' | 'partial_missing_tools' | 'partial_missing_transcription' | 'not_ready';
  readyServices: string[];
}

/**
 * Generate subtitles for a YouTube video using speech-to-text
 * 
 * @param videoId - YouTube video ID
 * @returns Promise with generated subtitles
 */
export async function generateSubtitles(videoId: string): Promise<Subtitle[]> {
  console.log(`[SubtitleGenService] Generating subtitles for ${videoId}...`);
  
  try {
    const response = await fetch(`${API_BASE}/generate-subtitles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });
    
    const data = await response.json().catch(() => ({ error: 'Failed to parse response' }));
    
    if (!response.ok) {
      console.error('[SubtitleGenService] Generation failed:', data);
      
      // Provide user-friendly error messages
      if (response.status === 503) {
        throw new Error(data.error || 'Subtitle generation service is not configured. Please check backend setup.');
      }
      
      throw new Error(data.error || 'Failed to generate subtitles');
    }
    
    console.log(`[SubtitleGenService] Generated ${data.subtitles.length} subtitles (cached: ${data.cached})`);
    
    // Convert to app's Subtitle format
    const subtitles: Subtitle[] = data.subtitles.map((sub: any, index: number) => ({
      id: `gen-${videoId}-${index}`,
      start: sub.start,
      end: sub.start + sub.duration,
      text: sub.text,
    }));
    
    return subtitles;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to backend server. Make sure it is running on port 3000.');
    }
    throw error;
  }
}

/**
 * Check if subtitles have been generated for a video
 * 
 * @param videoId - YouTube video ID
 * @returns Promise with status information
 */
export async function checkSubtitleStatus(videoId: string): Promise<SubtitleStatusResponse> {
  const response = await fetch(`${API_BASE}/generate-subtitles/status/${videoId}`);
  
  if (!response.ok) {
    return { exists: false };
  }
  
  return await response.json();
}

/**
 * Check if subtitle generation is properly configured
 * 
 * @returns Promise with configuration status
 */
export async function checkSubtitleConfig(): Promise<SubtitleConfigStatus> {
  try {
    const response = await fetch(`${API_BASE}/generate-subtitles/config`);
    
    if (!response.ok) {
      throw new Error('Failed to check config');
    }
    
    return await response.json();
  } catch (error) {
    console.error('[SubtitleGenService] Config check failed:', error);
    
    // Return default "not ready" status if backend is unreachable
    return {
      googleSpeech: {
        libraryInstalled: false,
        credentialsSet: false,
        credentialsPath: null,
        status: 'unknown'
      },
      gcs: {
        libraryInstalled: false,
        bucketSet: false,
        bucketName: null,
        status: 'unknown'
      },
      assemblyai: {
        apiKeySet: false,
        status: 'unknown'
      },
      ytdlp: {
        available: false,
        version: null,
        status: 'unknown'
      },
      ffmpeg: {
        available: false,
        version: null,
        status: 'unknown'
      },
      overallStatus: 'not_ready',
      readyServices: []
    };
  }
}

/**
 * Get human-readable status message for subtitle generation config
 */
export function getConfigStatusMessage(config: SubtitleConfigStatus): string {
  if (config.overallStatus === 'ready') {
    const services = config.readyServices.join(' and ');
    return `Ready to generate subtitles using ${services}`;
  }
  
  const issues: string[] = [];
  
  if (!config.ytdlp.available) {
    issues.push('yt-dlp not installed (pip install yt-dlp)');
  }
  if (!config.ffmpeg.available) {
    issues.push('ffmpeg not installed');
  }
  if (!config.gcs.libraryInstalled) {
    issues.push('google-cloud-storage not installed');
  }
  if (!config.gcs.bucketSet) {
    issues.push('GCS bucket not set (auto-create will run on first long video)');
  }
  if (!config.googleSpeech.credentialsSet && !config.assemblyai.apiKeySet) {
    issues.push('No transcription service configured (set GOOGLE_APPLICATION_CREDENTIALS or ASSEMBLYAI_API_KEY)');
  }
  
  return issues.length > 0 
    ? `Setup required: ${issues.join('; ')}`
    : 'Configuration incomplete';
}
