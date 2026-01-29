import { Subtitle } from '../types';

/**
 * Pad number with leading zeros
 */
function pad(num: number, size: number = 2): string {
  return num.toString().padStart(size, '0');
}

/**
 * Format time for SRT format (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Format time for VTT format (HH:MM:SS.mmm)
 */
function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(millis, 3)}`;
}

/**
 * Export subtitles to SRT format
 */
export function exportToSRT(subtitles: Subtitle[]): string {
  return subtitles.map((sub, index) => {
    const startTime = formatSRTTime(sub.start);
    const endTime = formatSRTTime(sub.end);
    
    return `${index + 1}
${startTime} --> ${endTime}
${sub.text}

`;
  }).join('');
}

/**
 * Export subtitles to WebVTT format
 */
export function exportToVTT(subtitles: Subtitle[]): string {
  const header = 'WEBVTT\n\n';
  
  const cues = subtitles.map((sub, index) => {
    const startTime = formatVTTTime(sub.start);
    const endTime = formatVTTTime(sub.end);
    
    return `${index + 1}
${startTime} --> ${endTime}
${sub.text}

`;
  }).join('');
  
  return header + cues;
}

/**
 * Trigger browser download of subtitle file
 */
export function downloadSubtitles(
  subtitles: Subtitle[],
  filename: string,
  format: 'srt' | 'vtt'
): void {
  if (!subtitles || subtitles.length === 0) {
    alert('No subtitles available to export');
    return;
  }
  
  const content = format === 'srt' ? exportToSRT(subtitles) : exportToVTT(subtitles);
  const mimeType = format === 'srt' ? 'text/plain' : 'text/vtt';
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}
