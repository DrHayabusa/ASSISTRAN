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

// Voices populate asynchronously in some browsers, so cache them.
let cachedVoices: SpeechSynthesisVoice[] = [];

/** Preload TTS voices. Call once on app start. */
export function warmUpVoices(): void {
  if (!isSpeechSynthesisSupported()) return;
  const load = () => {
    const v = window.speechSynthesis.getVoices();
    if (v.length) cachedVoices = v;
  };
  load();
  window.speechSynthesis.onvoiceschanged = load;
}

function getVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  const live = window.speechSynthesis.getVoices();
  if (live.length) cachedVoices = live;
  return cachedVoices;
}

/**
 * Score a voice for a language: language match plus a quality heuristic that
 * favours modern natural/neural/Google voices and penalises robotic ones.
 * Returns -1 when the voice is the wrong language.
 */
function scoreVoice(voice: SpeechSynthesisVoice, langCode: string): number {
  const base = langCode.split('-')[0].toLowerCase();
  const vlang = voice.lang.toLowerCase().replace('_', '-');
  let score: number;
  if (vlang === langCode.toLowerCase()) score = 100; // exact locale match
  else if (vlang.startsWith(base)) score = 60; // same language, different region
  else return -1; // wrong language

  const name = voice.name.toLowerCase();
  if (/google/.test(name)) score += 35; // Google voices are notably natural
  if (/natural|neural|premium|enhanced|wavenet|online/.test(name)) score += 45;
  if (/siri|eloquence|compact|espeak|pico/.test(name)) score -= 30; // robotic
  if (!voice.localService) score += 15; // cloud voices are usually higher quality
  if (voice.default) score += 3;
  return score;
}

/** Pick the most natural available voice for a language, or null if none match. */
export function pickBestVoice(langCode: string): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of getVoices()) {
    const s = scoreVoice(v, langCode);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return bestScore >= 0 ? best : null;
}

/** Speak `text` aloud in the given BCP-47 language using the best voice found. */
export function speak(text: string, langCode: string): void {
  if (!isSpeechSynthesisSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // interrupt anything currently being spoken
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langCode;
  // A slightly slower rate and natural pitch read more pleasantly than the
  // browser default, which tends to sound clipped and robotic.
  utter.rate = 0.96;
  utter.pitch = 1.0;
  const voice = pickBestVoice(langCode);
  if (voice) utter.voice = voice;
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
