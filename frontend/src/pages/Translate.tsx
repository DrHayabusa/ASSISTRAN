import { motion } from 'framer-motion';
import { AlertCircle, ArrowRightLeft, Copy, Mic, Send, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { LanguageDropdown } from '../components/ui/LanguageDropdown';
import { useApp } from '../context/AppContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { translate } from '../lib/api';
import { getLanguage, LANGUAGES } from '../lib/languages';
import { ensureMicPermission, speak, speechUnavailableReason } from '../lib/speech';
import { translationsStore } from '../lib/storage';
import type { TranslationRecord } from '../types';
import { cn, formatTime } from '../lib/utils';

/** Quick voice & text translation screen. */
export default function Translate() {
  const { user, logActivity } = useApp();
  const myLang = user?.preferredLanguage || 'british-english';
  // Default target: first language that isn't the user's own.
  const otherLang = LANGUAGES.find((l) => l.id !== myLang)?.id ?? 'hejazi-arabic';

  const [sourceLang, setSourceLang] = useState(myLang);
  const [targetLang, setTargetLang] = useState(otherLang);
  const [sourceText, setSourceText] = useState('');
  const [result, setResult] = useState('');
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TranslationRecord[]>(() =>
    user ? translationsStore.all(user.id) : [],
  );

  const srcMeta = getLanguage(sourceLang);
  const tgtMeta = getLanguage(targetLang);

  const { listening, transcript, error: srError, start, stop } = useSpeechRecognition({
    lang: srcMeta.speechCode,
    continuous: true,
  });
  // Non-null when voice input can't be used here (browser / insecure origin).
  const voiceBlocked = speechUnavailableReason();

  // Mirror the live transcript into the editable source box while listening.
  useEffect(() => {
    if (listening && transcript) setSourceText(transcript);
  }, [transcript, listening]);

  // Keep a ref to the latest source text so the mic stop handler can read it.
  const sourceRef = useRef(sourceText);
  sourceRef.current = sourceText;

  async function runTranslation(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    setError(null);
    setTranslating(true);
    setResult('');
    try {
      const translated = await translate(trimmed, sourceLang, targetLang);
      setResult(translated);
      speak(translated, tgtMeta.speechCode);
      translationsStore.add(user.id, {
        sourceText: trimmed,
        translatedText: translated,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });
      setHistory(translationsStore.all(user.id));
      logActivity({
        type: 'translation',
        title: `${srcMeta.short} → ${tgtMeta.short}`,
        detail: trimmed.slice(0, 60),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  }

  async function toggleMic() {
    // Explain precisely why voice is unavailable (unsupported browser / insecure origin).
    const reason = speechUnavailableReason();
    if (reason) {
      setError(reason);
      return;
    }
    if (listening) {
      stop();
      // Give the recognizer a beat to flush the final result, then translate.
      setTimeout(() => runTranslation(sourceRef.current), 350);
      return;
    }
    setResult('');
    setError(null);
    // Trigger a reliable permission prompt and report a clear error on denial.
    const perm = await ensureMicPermission();
    if (!perm.ok) {
      setError(perm.error ?? 'Microphone unavailable.');
      return;
    }
    start();
  }

  function swap() {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(result);
    setResult(sourceText);
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Translate" subtitle="Voice & text" backTo="/home" />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-4 no-scrollbar">
        {/* Language selector row */}
        <div className="flex items-center justify-between gap-2">
          <LanguageDropdown value={sourceLang} onChange={setSourceLang} compact />
          <button
            onClick={swap}
            className="rounded-full bg-ink-700/70 p-2 text-electric-light transition active:scale-90"
            aria-label="Swap languages"
          >
            <ArrowRightLeft size={18} />
          </button>
          <LanguageDropdown value={targetLang} onChange={setTargetLang} compact />
        </div>

        {/* Source text (editable + live transcript) */}
        <div className="glass-card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-white/40">
            <span>{srcMeta.flag}</span> {srcMeta.name}
            {listening && <span className="ml-auto text-electric-light">Listening…</span>}
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Tap the mic or type here…"
            dir={srcMeta.rtl ? 'rtl' : 'ltr'}
            rows={2}
            className="w-full resize-none bg-transparent text-lg outline-none placeholder-white/30"
          />
          {sourceText.trim() && !listening && (
            <button
              onClick={() => runTranslation(sourceText)}
              className="mt-1 flex items-center gap-1.5 text-sm font-medium text-electric-light"
            >
              <Send size={15} /> Translate
            </button>
          )}
        </div>

        {/* Result box */}
        <div className="glass-card min-h-[140px] bg-gradient-to-br from-electric/10 to-brandgreen/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/40">
            <span>{tgtMeta.flag}</span> {tgtMeta.name}
            {result && (
              <div className="ml-auto flex gap-1">
                <IconBtn onClick={() => speak(result, tgtMeta.speechCode)} label="Speak">
                  <Volume2 size={16} />
                </IconBtn>
                <IconBtn onClick={() => navigator.clipboard?.writeText(result)} label="Copy">
                  <Copy size={16} />
                </IconBtn>
              </div>
            )}
          </div>

          {translating ? (
            <div className="space-y-2 pt-1">
              <div className="shimmer h-5 w-3/4" />
              <div className="shimmer h-5 w-1/2" />
            </div>
          ) : result ? (
            <p
              dir={tgtMeta.rtl ? 'rtl' : 'ltr'}
              className="text-xl font-medium leading-relaxed text-white"
            >
              {result}
            </p>
          ) : (
            <p className="pt-3 text-sm text-white/30">Your translation will appear here.</p>
          )}
        </div>

        {(error || srError) && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertCircle size={16} className="shrink-0" />
            {error || `Microphone error: ${srError}`}
          </div>
        )}

        {/* Mic button */}
        <div className="flex flex-col items-center py-2">
          <button onClick={toggleMic} className="relative flex h-24 w-24 items-center justify-center" aria-label="Record">
            {listening && (
              <>
                <span className="absolute inset-0 rounded-full bg-electric/40 animate-pulsering" />
                <span className="absolute inset-0 rounded-full bg-electric/30 animate-pulsering [animation-delay:0.5s]" />
              </>
            )}
            <span
              className={cn(
                'relative flex h-20 w-20 items-center justify-center rounded-full shadow-glow transition-all',
                listening ? 'bg-red-500' : 'bg-brand-gradient',
              )}
            >
              <Mic size={32} />
            </span>
          </button>
          <p className="mt-3 text-xs text-white/40">
            {voiceBlocked
              ? 'Voice input unavailable — type above'
              : listening
                ? 'Tap to stop & translate'
                : 'Tap to speak'}
          </p>
          {voiceBlocked && (
            <p className="mt-2 max-w-xs text-center text-[11px] leading-relaxed text-amber-200/70">
              {voiceBlocked}
            </p>
          )}
        </div>

        {/* History panel */}
        {history.length > 0 && (
          <div>
            <h3 className="mb-2 px-1 text-sm font-semibold text-white/60">Recent translations</h3>
            <div className="flex flex-col gap-2">
              {history.slice(0, 8).map((rec) => (
                <motion.button
                  key={rec.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => speak(rec.translatedText, getLanguage(rec.targetLanguage).speechCode)}
                  className="glass rounded-2xl p-3 text-left"
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] text-white/40">
                    {getLanguage(rec.sourceLanguage).flag} → {getLanguage(rec.targetLanguage).flag}
                    <span className="ml-auto">{formatTime(rec.timestamp)}</span>
                  </div>
                  <p className="truncate text-sm text-white/60">{rec.sourceText}</p>
                  <p className="truncate text-sm font-medium text-white">{rec.translatedText}</p>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
