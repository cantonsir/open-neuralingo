import { Subtitle } from './types';

// Convert HH:MM:SS.mmm or MM:SS.mmm to seconds
export const parseTime = (timeStr: string): number => {
  const parts = timeStr.split(':');
  let seconds = 0;
  let multiplier = 1;

  // Process from right to left (seconds, minutes, hours)
  for (let i = parts.length - 1; i >= 0; i--) {
    seconds += parseFloat(parts[i].replace(',', '.')) * multiplier;
    multiplier *= 60;
  }
  return seconds;
};

// Simple VTT/SRT parser
export const parseSubtitles = (input: string): Subtitle[] => {
  const lines = input.trim().split(/\r?\n/);
  const subtitles: Subtitle[] = [];
  let currentStart = 0;
  let currentEnd = 0;
  let currentText = [];
  let isReadingText = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines or WEBVTT header
    if (!line || line === 'WEBVTT') {
      if (currentText.length > 0) {
        subtitles.push({
          id: Math.random().toString(36).substr(2, 9),
          start: currentStart,
          end: currentEnd,
          text: currentText.join(' '),
        });
        currentText = [];
        isReadingText = false;
      }
      continue;
    }

    // Check for timestamp line (00:00:00.000 --> 00:00:05.000)
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim());
      currentStart = parseTime(startStr);
      currentEnd = parseTime(endStr);
      isReadingText = true;
      continue;
    }

    // If reading text, append line
    if (isReadingText && !line.match(/^\d+$/)) { // Skip purely numeric lines (sequence numbers)
      currentText.push(line);
    }
  }

  // Push last one
  if (currentText.length > 0) {
    subtitles.push({
      id: Math.random().toString(36).substr(2, 9),
      start: currentStart,
      end: currentEnd,
      text: currentText.join(' '),
    });
  }

  return subtitles;
};

// YouTube TimedText XML parser
export const parseYouTubeXml = (xmlText: string): Subtitle[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const textEvents = xmlDoc.getElementsByTagName('text');
  const subtitles: Subtitle[] = [];

  for (let i = 0; i < textEvents.length; i++) {
    const node = textEvents[i];
    const start = parseFloat(node.getAttribute('start') || '0');
    const dur = parseFloat(node.getAttribute('dur') || '0');
    const text = node.textContent || '';

    // Clean up HTML entities (YouTube XML often contains &amp; etc)
    const cleanText = text
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    if (cleanText) {
      subtitles.push({
        id: Math.random().toString(36).substr(2, 9),
        start: start,
        end: start + dur,
        text: cleanText,
      });
    }
  }

  return subtitles;
};

export const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
