import { motion } from 'framer-motion';
import {
  AlertCircle,
  Camera,
  CameraOff,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Send,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { LanguageDropdown } from '../../components/ui/LanguageDropdown';
import { useApp } from '../../context/AppContext';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { DEMO_PERSONAS, randomReply } from '../../lib/personas';
import { getLanguage } from '../../lib/languages';
import { translate } from '../../lib/api';
import { speak } from '../../lib/speech';
import { cn, colorFor, formatTime, uid as makeId } from '../../lib/utils';

interface RoomState {
  title?: string;
  isHost?: boolean;
  name?: string;
  lang?: string;
  camera?: boolean;
  mic?: boolean;
}

/** A participant shown in the room (the simulated remote users). */
interface Participant {
  id: string;
  name: string;
  lang: string;
  color: string;
}

/** One spoken line in the live translation feed. */
interface Utterance {
  id: string;
  speakerId: string;
  speakerName: string;
  originalText: string;
  originalLang: string;
  translatedText: string;
  translating: boolean;
  timestamp: number;
}

interface MeetChat {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

/**
 * Zoom-style meeting room, adapted to a mobile portrait layout.
 *
 * SIMULATED for local testing: remote participants are local mock users.
 * Tap a participant tile to make them "speak" — their line (in their own
 * language) is translated into YOUR language and read aloud, exactly as a real
 * remote stream would be handled. Real WebRTC/socket transport can be added
 * later without changing this UI or the translation flow.
 */
export default function MeetingRoom() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logActivity } = useApp();
  const state = (location.state ?? {}) as RoomState;

  const myName = state.name || user?.name || 'You';
  const [myLang, setMyLang] = useState(state.lang || user?.preferredLanguage || 'british-english');
  const myLangMeta = getLanguage(myLang);
  const isHost = state.isHost ?? false;

  const [camOn, setCamOn] = useState(state.camera ?? true);
  const [micOn, setMicOn] = useState(state.mic ?? true);
  const [handRaised, setHandRaised] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [feed, setFeed] = useState<Utterance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<MeetChat[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Two simulated remote participants whose languages differ from the user's,
  // so the live translation is meaningful.
  const others = useMemo<Participant[]>(() => {
    const picks = DEMO_PERSONAS.filter((p) => p.preferredLanguage !== myLang).slice(0, 2);
    const list = picks.length ? picks : DEMO_PERSONAS.slice(0, 2);
    return list.map((p) => ({ id: p.username, name: p.name, lang: p.preferredLanguage, color: p.avatarColor }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myVideoRef = useRef<HTMLVideoElement | null>(null);
  const myStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const { supported, transcript, start, stop } = useSpeechRecognition({
    lang: myLangMeta.speechCode,
    continuous: true,
  });
  const transcriptRef = useRef('');
  transcriptRef.current = transcript;

  // Log the join once.
  useEffect(() => {
    logActivity({ type: 'meeting_joined', title: state.title || 'ASSISTRAN Meeting', detail: `Code ${code}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manage the local camera tile.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!camOn) {
        myStreamRef.current?.getTracks().forEach((t) => t.stop());
        myStreamRef.current = null;
        if (myVideoRef.current) myVideoRef.current.srcObject = null;
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        myStreamRef.current = s;
        if (myVideoRef.current) myVideoRef.current.srcObject = s;
      } catch {
        setError('Camera unavailable or permission denied.');
        setCamOn(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [camOn]);

  // Stop all media on unmount.
  useEffect(() => {
    return () => {
      myStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Keep the feed scrolled to the latest line.
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed]);

  /** Translate with a graceful fallback so the room never hard-fails. */
  async function safeTranslate(text: string, from: string, to: string): Promise<string> {
    try {
      return await translate(text, from, to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed.');
      return text;
    }
  }

  // ---- Push-to-talk (me) --------------------------------------------------
  function startTalking() {
    if (!micOn) return setError('Your microphone is off.');
    if (speakingId && speakingId !== 'me') return; // someone else has the floor
    if (!supported) return setError('Speech recognition is not supported in this browser.');
    setError(null);
    setSpeakingId('me');
    start();
  }

  function stopTalking() {
    if (speakingId !== 'me') return;
    stop();
    setSpeakingId(null);
    const text = transcriptRef.current.trim();
    if (!text) return;
    // My own line — shown in my language as I said it (no translation needed for me).
    setFeed((f) => [
      ...f,
      {
        id: makeId('u_'),
        speakerId: 'me',
        speakerName: myName,
        originalText: text,
        originalLang: myLang,
        translatedText: '',
        translating: false,
        timestamp: Date.now(),
      },
    ]);
  }

  // ---- Simulated remote speaker -------------------------------------------
  async function simulateSpeaker(p: Participant) {
    if (speakingId) return; // enforce one speaker at a time
    setSpeakingId(p.id);
    const original = randomReply(p.id);
    const id = makeId('u_');
    setFeed((f) => [
      ...f,
      {
        id,
        speakerId: p.id,
        speakerName: p.name,
        originalText: original,
        originalLang: p.lang,
        translatedText: '',
        translating: true,
        timestamp: Date.now(),
      },
    ]);
    const translated = await safeTranslate(original, p.lang, myLang);
    setFeed((f) => f.map((u) => (u.id === id ? { ...u, translatedText: translated, translating: false } : u)));
    speak(translated, myLangMeta.speechCode);
    setTimeout(() => setSpeakingId((cur) => (cur === p.id ? null : cur)), 2200);
  }

  // ---- Screen share -------------------------------------------------------
  async function toggleShare() {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setSharing(false);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = s;
      setSharing(true);
      // Chrome's native "Stop sharing" ends the track.
      s.getVideoTracks()[0]?.addEventListener('ended', () => {
        screenStreamRef.current = null;
        setSharing(false);
      });
      // Attach after render.
      setTimeout(() => {
        if (screenVideoRef.current) screenVideoRef.current.srcObject = s;
      }, 50);
    } catch {
      setError('Screen sharing was cancelled or is not permitted.');
    }
  }

  function leave() {
    myStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    navigate('/home');
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((m) => [...m, { id: makeId('c_'), sender: myName, text, timestamp: Date.now() }]);
    setChatInput('');
  }

  const participantCount = others.length + 1;

  return (
    <div className="flex h-full flex-1 flex-col bg-ink-950">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-ink-900/80 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{state.title || 'ASSISTRAN Meeting'}</p>
          <p className="text-[11px] text-white/40">Code {code}</p>
        </div>
        {isHost && (
          <span className="rounded-full bg-electric/20 px-2 py-0.5 text-[10px] font-semibold text-electric-light">
            HOST
          </span>
        )}
        <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs">
          <Users size={13} /> {participantCount}
        </span>
      </div>

      {/* Participant tiles */}
      <div className="flex gap-2 overflow-x-auto border-b border-white/5 px-3 py-2.5 no-scrollbar">
        {/* My tile */}
        <Tile speaking={speakingId === 'me'} handRaised={handRaised}>
          {camOn ? (
            <video ref={myVideoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          ) : (
            <TilePlaceholder name={myName} color={colorFor(myName)} />
          )}
          <TileLabel name={`${myName} (You)`} flag={myLangMeta.flag} muted={!micOn} />
        </Tile>

        {/* Remote (simulated) tiles — tap to hear them speak */}
        {others.map((p) => (
          <Tile key={p.id} speaking={speakingId === p.id} onClick={() => simulateSpeaker(p)}>
            <TilePlaceholder name={p.name} color={p.color} />
            <TileLabel name={p.name} flag={getLanguage(p.lang).flag} />
          </Tile>
        ))}
      </div>

      {/* Main area: large box + (when sharing) smaller translation box */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
        {/* Large box */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-ink-800">
          {sharing ? (
            <video ref={screenVideoRef} autoPlay playsInline className="h-full w-full bg-black object-contain" />
          ) : (
            <TranslationFeed feed={feed} myLang={myLang} endRef={feedEndRef} />
          )}
          {sharing && (
            <span className="absolute left-3 top-3 rounded-full bg-brandgreen/90 px-2.5 py-1 text-[11px] font-semibold">
              Screen sharing
            </span>
          )}
        </div>

        {/* Smaller box — only while screen sharing, holds the translation feed */}
        {sharing && (
          <div className="h-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-ink-800">
            <TranslationFeed feed={feed} myLang={myLang} endRef={feedEndRef} compact />
          </div>
        )}
      </div>

      {error && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-200/70">
            Dismiss
          </button>
        </div>
      )}

      {/* Push-to-talk */}
      <div className="px-3">
        <button
          onPointerDown={startTalking}
          onPointerUp={stopTalking}
          onPointerLeave={stopTalking}
          onPointerCancel={stopTalking}
          className={cn(
            'flex w-full touch-none select-none items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold transition',
            speakingId === 'me'
              ? 'bg-red-500 text-white shadow-glow'
              : speakingId
                ? 'bg-white/5 text-white/40'
                : 'bg-brand-gradient text-white shadow-glow',
          )}
          disabled={!!speakingId && speakingId !== 'me'}
        >
          {speakingId === 'me' ? (
            <>
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2 w-2 rounded-full bg-white"
                    animate={{ scaleY: [1, 2, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
              Listening… release to send
            </>
          ) : speakingId ? (
            <>Someone is speaking…</>
          ) : (
            <>
              <Mic size={18} /> Hold to speak
            </>
          )}
        </button>
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto px-3 py-3 no-scrollbar">
        <Control label="Camera" active={camOn} onClick={() => setCamOn((v) => !v)} icon={camOn ? <Camera size={20} /> : <CameraOff size={20} />} />
        <Control label="Mic" active={micOn} onClick={() => setMicOn((v) => !v)} icon={micOn ? <Mic size={20} /> : <MicOff size={20} />} />
        <Control
          label="Share"
          active={sharing}
          highlight={sharing}
          onClick={toggleShare}
          icon={sharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
        />
        <Control label="Hand" active={!handRaised} highlight={handRaised} onClick={() => setHandRaised((v) => !v)} icon={<Hand size={20} />} />
        <Control label="Chat" active onClick={() => setChatOpen(true)} icon={<MessageSquare size={20} />} />
        <Control label="Settings" active onClick={() => setSettingsOpen(true)} icon={<SettingsIcon size={20} />} />
        <Control label={isHost ? 'End' : 'Leave'} danger onClick={leave} icon={<PhoneOff size={20} />} />
      </div>

      {/* Meeting chat */}
      <Modal open={chatOpen} onClose={() => setChatOpen(false)} title="Meeting chat">
        <div className="mb-3 flex max-h-60 min-h-[8rem] flex-col gap-2 overflow-y-auto no-scrollbar">
          {chatMessages.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">No messages yet.</p>
          ) : (
            chatMessages.map((m) => (
              <div key={m.id} className="glass rounded-xl px-3 py-2 text-sm">
                <span className="mr-2 font-semibold text-electric-light">{m.sender}</span>
                <span className="text-white/80">{m.text}</span>
                <span className="ml-2 text-[10px] text-white/30">{formatTime(m.timestamp)}</span>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Type a message…"
            className="input-field flex-1"
          />
          <button onClick={sendChat} className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient">
            <Send size={18} />
          </button>
        </div>
      </Modal>

      {/* In-meeting settings */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Meeting settings">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-white/80">Your language</span>
          <LanguageDropdown value={myLang} onChange={setMyLang} compact />
        </div>
        <div className="mt-2 space-y-1 text-xs text-white/40">
          <p>Translations of others' speech will appear in your language.</p>
        </div>
      </Modal>
    </div>
  );
}

// ---- Sub-components --------------------------------------------------------

function Tile({
  children,
  speaking,
  handRaised,
  onClick,
}: {
  children: React.ReactNode;
  speaking?: boolean;
  handRaised?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-ink-700 transition',
        speaking ? 'border-brandgreen shadow-glow-green' : 'border-white/10',
      )}
    >
      {children}
      {handRaised && (
        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-ink-900">
          <Hand size={13} />
        </span>
      )}
    </button>
  );
}

function TilePlaceholder({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center text-xl font-bold text-white"
      style={{ background: `linear-gradient(135deg, ${color}55, ${color}22)` }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
      >
        {name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
      </span>
    </div>
  );
}

function TileLabel({ name, flag, muted }: { name: string; flag: string; muted?: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3">
      <span className="text-xs">{flag}</span>
      <span className="truncate text-[10px] font-medium text-white">{name}</span>
      {muted && <MicOff size={11} className="ml-auto text-red-400" />}
    </div>
  );
}

function TranslationFeed({
  feed,
  myLang,
  endRef,
  compact,
}: {
  feed: Utterance[];
  myLang: string;
  endRef: React.RefObject<HTMLDivElement>;
  compact?: boolean;
}) {
  if (feed.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white/40">
        <Mic size={compact ? 22 : 34} className="mb-2 opacity-40" />
        <p className={cn('font-medium', compact && 'text-sm')}>Live translation</p>
        {!compact && (
          <p className="mt-1 text-sm">Hold “Hold to speak”, or tap a participant tile to hear them speak.</p>
        )}
      </div>
    );
  }
  return (
    <div className={cn('h-full space-y-2 overflow-y-auto p-3 no-scrollbar', compact && 'space-y-1.5 p-2')}>
      {feed.map((u) => {
        const isMe = u.speakerId === 'me';
        const origMeta = getLanguage(u.originalLang);
        const showTranslation = !isMe && u.originalLang !== myLang;
        return (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-xl bg-white/5 p-2.5', compact && 'p-2 text-sm')}
          >
            <p className="mb-0.5 text-[11px] text-white/40">
              <span className="font-semibold text-white/70">{u.speakerName}</span> spoke in {origMeta.name}
            </p>
            <p dir={origMeta.rtl ? 'rtl' : 'ltr'} className="text-sm text-white/60">
              {u.originalText}
            </p>
            {showTranslation &&
              (u.translating ? (
                <div className="mt-1.5 space-y-1">
                  <div className="shimmer h-3.5 w-3/4" />
                </div>
              ) : (
                <p
                  dir={getLanguage(myLang).rtl ? 'rtl' : 'ltr'}
                  className="mt-1 font-medium text-electric-light"
                >
                  {u.translatedText}
                </p>
              ))}
          </motion.div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function Control({
  label,
  icon,
  onClick,
  active,
  danger,
  highlight,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  highlight?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex shrink-0 flex-col items-center gap-1">
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full transition active:scale-90',
          danger
            ? 'bg-red-500 text-white'
            : highlight
              ? 'bg-brandgreen text-white'
              : active
                ? 'bg-white/10 text-white'
                : 'bg-red-500/90 text-white',
        )}
      >
        {icon}
      </span>
      <span className="text-[10px] text-white/50">{label}</span>
    </button>
  );
}
