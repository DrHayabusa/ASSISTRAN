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

/** True when the page may use mic/camera APIs (HTTPS or localhost). */
export function isSecureMediaContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

/**
 * Returns a human-readable reason why voice input is unavailable, or null if
 * it should work. Covers the two most common gotchas: an unsupported browser
 * and an insecure origin (a LAN IP instead of localhost/HTTPS), where browsers
 * silently block the microphone.
 */
export function speechUnavailableReason(): string | null {
  if (!isSecureMediaContext()) {
    return 'Voice input needs a secure page. Open the app at http://localhost:5173 — microphones are blocked on a plain LAN/IP address. To test on a phone, serve the app over HTTPS.';
  }
  if (!isSpeechRecognitionSupported()) {
    return 'Voice input is not supported in this browser. Use Google Chrome or Microsoft Edge — Firefox, Safari and Brave do not support speech recognition reliably.';
  }
  return null;
}

/** Map a SpeechRecognition error code to a clear, actionable message. */
export function describeSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Click the lock/camera icon in the address bar, allow the microphone, then try again.';
    case 'audio-capture':
      return 'No microphone was found. Check that a mic is connected and not in use by another app.';
    case 'network':
      return 'Speech recognition needs an internet connection (the browser processes audio online). Check your connection.';
    case 'no-speech':
      return 'No speech detected. Try again and speak clearly.';
    case 'aborted':
      return 'Listening was interrupted. Try again.';
    default:
      return `Microphone error: ${code}`;
  }
}

/**
 * Probe microphone access via getUserMedia so the permission prompt reliably
 * appears and a denial produces a precise error. The probe stream is closed
 * immediately; SpeechRecognition then opens its own.
 */
export async function ensureMicPermission(): Promise<{ ok: boolean; error?: string }> {
  if (!isSecureMediaContext() || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: speechUnavailableReason() ?? 'The microphone is unavailable in this context.' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return { ok: false, error: describeSpeechError('not-allowed') };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, error: describeSpeechError('audio-capture') };
    }
    return { ok: false, error: 'Could not access the microphone. Check your browser permissions and try again.' };
  }
}
