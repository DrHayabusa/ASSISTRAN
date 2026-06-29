import { Router } from 'express';
import { translateText } from '../services/ollama';

const router = Router();

/**
 * POST /api/translate
 *
 * Request body:  { text: string, source: string, target: string }
 * Response:      { translation: string }
 *
 * The frontend always calls this route — it never talks to Ollama directly.
 */
router.post('/translate', async (req, res) => {
  const { text, source, target } = (req.body ?? {}) as {
    text?: unknown;
    source?: unknown;
    target?: unknown;
  };

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Field "text" is required and must be a non-empty string.' });
  }
  if (typeof source !== 'string' || !source.trim()) {
    return res.status(400).json({ error: 'Field "source" is required and must be a non-empty string.' });
  }
  if (typeof target !== 'string' || !target.trim()) {
    return res.status(400).json({ error: 'Field "target" is required and must be a non-empty string.' });
  }

  // No work needed when source and target languages are identical.
  if (source.trim().toLowerCase() === target.trim().toLowerCase()) {
    return res.json({ translation: text });
  }

  try {
    const translation = await translateText(text, source, target);
    return res.json({ translation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/translate] failed:', message);
    // 502: we are a gateway to Ollama and the upstream call failed.
    return res.status(502).json({ error: `Translation failed: ${message}` });
  }
});

export default router;
