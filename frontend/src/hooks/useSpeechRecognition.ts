import { useCallback, useEffect, useRef, useState } from 'react';
import {
  describeSpeechError,
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  type SpeechRecognitionInstance,
} from '../lib/speech';

interface Options {
  /** BCP-47 language code, e.g. "en-GB". */
  lang: string;
  /** Keep listening until stopped (useful for push-to-talk). */
  continuous?: boolean;
}

/**
 * React hook around the Web Speech API recognition. Exposes live interim
 * text plus the finalized transcript. Falls back gracefully (`supported:false`)
 * in browsers without speech recognition.
 */
export function useSpeechRecognition({ lang, continuous = true }: Options) {
  const supported = isSpeechRecognitionSupported();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = useRef('');

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Build (or rebuild) the recognition instance when language changes.
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onerror = (e) => {
      // "no-speech" / "aborted" are routine; surface only meaningful errors,
      // mapped to clear, actionable messages.
      if (e.error !== 'no-speech' && e.error !== 'aborted') setError(describeSpeechError(e.error));
    };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalRef.current += text;
        else interim += text;
      }
      setTranscript((finalRef.current + ' ' + interim).trim());
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [lang, continuous]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    finalRef.current = '';
    setTranscript('');
    setError(null);
    try {
      recognitionRef.current.start();
    } catch {
      /* start() throws if already started — safe to ignore */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    finalRef.current = '';
    setTranscript('');
    setError(null);
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}
