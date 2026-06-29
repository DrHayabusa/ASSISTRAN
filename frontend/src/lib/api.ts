import { languageName } from './languages';

/**
 * POST JSON to a backend route and parse the JSON response, turning the common
 * failure modes into clear, actionable error messages:
 *  - the backend is unreachable (not running / served without the API),
 *  - a 404/405 (the app was opened without the backend behind /api),
 *  - a structured { error } payload from our own routes.
 *
 * The frontend ALWAYS uses relative "/api/*" paths; Vite (dev) or your reverse
 * proxy (prod) forwards them to the backend. The browser never sees Ollama.
 */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Cannot reach the ASSISTRAN backend. Make sure it is running (start everything with "npm run dev").',
    );
  }

  const raw = await res.text();
  let payload: { error?: string } & Record<string, unknown> = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      /* response was not JSON (e.g. an HTML error page from a static host) */
    }
  }

  if (!res.ok) {
    if (payload.error) throw new Error(payload.error);
    if (res.status === 404 || res.status === 405) {
      throw new Error(
        `The translation API isn't reachable (HTTP ${res.status}). The app must be served with the backend running behind /api — use "npm run dev" and open http://localhost:5173, not the built files on their own.`,
      );
    }
    throw new Error(`Request failed (HTTP ${res.status}).`);
  }
  return payload as T;
}

/**
 * Low-level translate call. Sends language *names* (e.g. "British English")
 * exactly as the backend / interpreter prompt expects.
 */
export async function apiTranslate(text: string, sourceName: string, targetName: string): Promise<string> {
  const payload = await postJson<{ translation?: string }>('/api/translate', {
    text,
    source: sourceName,
    target: targetName,
  });
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

export interface ReplyTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Ask the backend to generate an in-character reply for a SIMULATED user (a
 * chat friend or meeting participant). `language` is the language NAME the
 * persona writes in (e.g. "Spanish"). Used to make demo bots respond smartly.
 */
export async function generateReply(params: {
  personaName: string;
  language: string;
  context: string;
  messages: ReplyTurn[];
}): Promise<string> {
  const payload = await postJson<{ reply?: string }>('/api/reply', params);
  if (typeof payload.reply !== 'string') throw new Error('Backend response did not include a reply.');
  return payload.reply;
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
