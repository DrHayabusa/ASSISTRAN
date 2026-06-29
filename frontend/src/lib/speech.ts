// ---------------------------------------------------------------------------
// Thin wrappers around the browser Web Speech API.
// These APIs are not part of the standard TS DOM lib, so we declare the
// minimal shapes we use. Speech recognition is best supported in Chrome/Edge;
// the app always provides a typed-text fallback when it is unavailable.
// ---------------------------------------------------------------------------

export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Speak `text` aloud in the given BCP-47 language, choosing a matching voice. */
export function speak(text: string, langCode: string): void {
  if (!isSpeechSynthesisSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // interrupt anything currently being spoken
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langCode;
  utter.rate = 1;
  utter.pitch = 1;
  const voices = synth.getVoices();
  const base = langCode.split('-')[0];
  const match = voices.find((v) => v.lang === langCode) || voices.find((v) => v.lang.startsWith(base));
  if (match) utter.voice = match;
  synth.speak(utter);
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
