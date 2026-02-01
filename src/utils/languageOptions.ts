export interface LanguageOption {
  code: string;
  name: string;
  flag?: string;
  ttsCode: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', ttsCode: 'en-US' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', ttsCode: 'es-ES' },
  { code: 'fr', name: 'French', flag: '🇫🇷', ttsCode: 'fr-FR' },
  { code: 'de', name: 'German', flag: '🇩🇪', ttsCode: 'de-DE' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', ttsCode: 'ja-JP' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', ttsCode: 'ko-KR' },
  { code: 'zh-CN', name: 'Simplified Chinese', flag: '🇨🇳', ttsCode: 'cmn-CN' },
  { code: 'zh-TW', name: 'Traditional Chinese', flag: '🇹🇼', ttsCode: 'cmn-TW' },
  { code: 'yue', name: 'Cantonese', flag: '🇭🇰', ttsCode: 'yue-HK' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', ttsCode: 'pt-BR' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', ttsCode: 'ru-RU' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', ttsCode: 'it-IT' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', ttsCode: 'ar-XA' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', ttsCode: 'hi-IN' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', ttsCode: 'vi-VN' },
  { code: 'th', name: 'Thai', flag: '🇹🇭', ttsCode: 'th-TH' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', ttsCode: 'id-ID' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', ttsCode: 'tr-TR' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', ttsCode: 'nl-NL' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', ttsCode: 'pl-PL' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪', ttsCode: 'sv-SE' }
];

export function normalizeLanguageCode(code?: string): string {
  if (!code) return 'en';
  if (code === 'zh') return 'zh-CN';
  return code;
}

export function getLanguageName(code?: string): string {
  const normalized = normalizeLanguageCode(code);
  const match = SUPPORTED_LANGUAGES.find((lang) => lang.code === normalized);
  return match?.name || 'English';
}

export function getTtsLanguageCode(code?: string): string {
  const normalized = normalizeLanguageCode(code);
  const match = SUPPORTED_LANGUAGES.find((lang) => lang.code === normalized);
  if (match?.ttsCode) return match.ttsCode;
  if (normalized.includes('-')) return normalized;
  return 'en-US';
}
