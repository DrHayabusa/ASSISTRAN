import { languageName } from './languages';

/**
 * Low-level translate call. Sends language *names* (e.g. "British English")
 * exactly as the backend / interpreter prompt expects.
 *
 * The frontend ALWAYS calls the backend at the relative path "/api/translate".
 * It never talks to Ollama directly — Vite proxies /api to the backend.
 */
export async function apiTranslate(text: string, sourceName: string, targetName: string): Promise<string> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source: sourceName, target: targetName }),
  });

  let payload: { translation?: string; error?: string } = {};
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Backend returned an invalid response (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(payload.error || `Translation request failed (HTTP ${res.status}).`);
  }
  if (typeof payload.translation !== 'string') {
    throw new Error('Backend response did not include a translation.');
  }
  return payload.translation;
}

/**
 * Convenience wrapper that accepts language *ids* (e.g. "british-english")
 * and converts them to the names the backend expects.
 */
export async function translate(text: string, sourceLangId: string, targetLangId: string): Promise<string> {
  if (sourceLangId === targetLangId) return text;
  return apiTranslate(text, languageName(sourceLangId), languageName(targetLangId));
}

/** Check that the backend is up. */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}
