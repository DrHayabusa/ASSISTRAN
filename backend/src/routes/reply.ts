import { Router } from 'express';
import { generateReply, type ChatTurn } from '../services/ollama';

const router = Router();

/**
 * POST /api/reply
 *
 * Generates an in-character conversational reply for a SIMULATED user (a chat
 * friend or meeting participant). Kept separate from /api/translate so the
 * interpreter prompt stays strictly a translator.
 *
 * Request body:
 *   {
 *     personaName: string,
 *     language: string,            // language the persona writes in, e.g. "Spanish"
 *     context?: string,            // e.g. "chatting 1:1" or "in a live meeting about X"
 *     messages: { role: "user" | "assistant", content: string }[]
 *   }
 * Response: { reply: string }
 */
router.post('/reply', async (req, res) => {
  const { personaName, language, context, messages } = (req.body ?? {}) as {
    personaName?: unknown;
    language?: unknown;
    context?: unknown;
    messages?: unknown;
  };

  if (typeof personaName !== 'string' || !personaName.trim()) {
    return res.status(400).json({ error: 'Field "personaName" is required.' });
  }
  if (typeof language !== 'string' || !language.trim()) {
    return res.status(400).json({ error: 'Field "language" is required.' });
  }
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Field "messages" must be an array.' });
  }

  // Only accept user/assistant turns from the client — never a system role.
  const turns: ChatTurn[] = [];
  for (const m of messages) {
    if (m && typeof m === 'object' && typeof (m as { content?: unknown }).content === 'string') {
      const content = (m as { content: string }).content.trim();
      const role = (m as { role?: unknown }).role === 'assistant' ? 'assistant' : 'user';
      if (content) turns.push({ role, content });
    }
  }

  try {
    const reply = await generateReply({
      personaName,
      language,
      context: typeof context === 'string' && context.trim() ? context.trim() : 'chatting on a messaging app',
      messages: turns,
    });
    return res.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/reply] failed:', message);
    return res.status(502).json({ error: `Reply failed: ${message}` });
  }
});

export default router;
