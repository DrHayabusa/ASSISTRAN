import type { Language } from '../types';

/**
 * The 11 supported languages. `name` is exactly what we send to the backend
 * (and therefore to the Ollama interpreter prompt). `speechCode` is the
 * closest BCP-47 tag for browser speech recognition / synthesis.
 */
export const LANGUAGES: Language[] = [
  { id: 'british-english', name: 'British English', short: 'English', flag: '🇬🇧', speechCode: 'en-GB' },
  { id: 'hejazi-arabic', name: 'Hejazi Arabic', short: 'Hejazi', flag: '🇸🇦', speechCode: 'ar-SA', rtl: true },
  { id: 'spanish', name: 'Spanish', short: 'Spanish', flag: '🇪🇸', speechCode: 'es-ES' },
  { id: 'mandarin-chinese', name: 'Mandarin Chinese', short: 'Mandarin', flag: '🇨🇳', speechCode: 'zh-CN' },
  { id: 'japanese', name: 'Japanese', short: 'Japanese', flag: '🇯🇵', speechCode: 'ja-JP' },
  { id: 'tamil', name: 'Tamil', short: 'Tamil', flag: '🇮🇳', speechCode: 'ta-IN' },
  { id: 'hindi', name: 'Hindi', short: 'Hindi', flag: '🇮🇳', speechCode: 'hi-IN' },
  { id: 'french', name: 'French', short: 'French', flag: '🇫🇷', speechCode: 'fr-FR' },
  { id: 'emirati-arabic', name: 'Emirati Arabic', short: 'Emirati', flag: '🇦🇪', speechCode: 'ar-AE', rtl: true },
  { id: 'portuguese', name: 'Portuguese', short: 'Portuguese', flag: '🇵🇹', speechCode: 'pt-PT' },
  { id: 'russian', name: 'Russian', short: 'Russian', flag: '🇷🇺', speechCode: 'ru-RU' },
];

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

/** Look up a language by id, defaulting to British English. */
export function getLanguage(id: string | undefined | null): Language {
  return (id && BY_ID.get(id)) || LANGUAGES[0];
}

/** The human-readable name we send to the backend for a given language id. */
export function languageName(id: string | undefined | null): string {
  return getLanguage(id).name;
}
