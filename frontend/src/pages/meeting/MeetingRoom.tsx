import { motion } from 'framer-motion';
import {
  AlertCircle,
  Camera,
  CameraOff,
  Hand,
  Languages,
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
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { type Track } from 'livekit-client';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../context/AppContext';
import { useMeetingSocket, type RoomMessage } from '../../hooks/useMeetingSocket';
import { useLiveKit } from '../../hooks/useLiveKit';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { meetingApi, type JoinResult } from '../../lib/api';
import { translate } from '../../lib/api';
import { getLanguage } from '../../lib/languages';
import { speechUnavailableReason } from '../../lib/speech';
import { cn, colorFor, formatTime } from '../../lib/utils';

interface RoomState {
  join?: JoinResult;
  camera?: boolean;
  mic?: boolean;
}

/**
 * Real multi-user meeting room. Everyone who opens the same code shares one
 * room: presence + chat + live translated transcripts over Socket.IO, and
 * audio/video over LiveKit (SFU). Each participant reads transcripts/chat in
 * their own language.
 */
export default function MeetingRoom() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as RoomState;

  // Without a join payload (e.g. a hard refresh) send the user back to setup.
  useEffect(() => {
    if (!state.join) navigate(`/meeting/${code}/setup`, { replace: true });
  }, [state.join, code, navigate]);

  if (!state.join) return null;
  return <Room join={state.join} code={code} camera={state.camera ?? true} mic={state.mic ?? true} />;
}

/** The live room — only mounted once we have a join payload, so hooks run unconditionally. */
function Room({ join, code, camera, mic }: { join: JoinResult; code: string; camera: boolean; mic: boolean }) {
  const navigate = useNavigate();
  const { logActivity } = useApp();

  const myUserId = join.self.id;
  const myName = join.self.displayName;
  const myLang = join.self.preferredLanguage;
  const myLangMeta = getLanguage(myLang);
  const isHost = join.self.role === 'host';
  const title = join.meeting.title;

  const sock = useMeetingSocket({ code, displayName: myName, language: myLang });
  const lk = useLiveKit({
    url: join.livekit?.url ?? null,
    token: join.livekit?.token ?? null,
    camera,
    mic,
  });
  const stt = useSpeechRecognition({ lang: myLangMeta.speechCode, continuous: true });
  const transcriptRef = useRef('');
  transcriptRef.current = stt.transcript;

  const [handRaised, setHandRaised] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [tx, setTx] = useState<Record<string, string>>({});
  const processedRef = useRef<Set<string>>(new Set());
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logActivity({ type: 'meeting_joined', title, detail: `Code ${code}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Translate any incoming chat/transcript (not mine, different language) into my language.
  useEffect(() => {
    const items: RoomMessage[] = [...sock.chat, ...sock.transcripts];
    for (const item of items) {
      if (processedRef.current.has(item.id)) continue;
      processedRef.current.add(item.id);
      if (item.senderId === myUserId || !item.originalLanguage || item.originalLanguage === myLang) continue;
      translate(item.originalText, item.originalLanguage, myLang)
        .then((t) => setTx((prev) => ({ ...prev, [item.id]: t })))
        .catch(() => undefined);
    }
  }, [sock.chat, sock.transcripts, myLang, myUserId]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sock.transcripts]);

  /** The text to show for a message in MY language. */
  function displayText(item: RoomMessage): string {
    if (item.senderId === myUserId) return item.originalText;
    if (!item.originalLanguage || item.originalLanguage === myLang) return item.originalText;
    return tx[item.id] ?? '…';
  }

  // ---- Push-to-talk (server floor lock + STT) ----
  const floorHeldByOther = !!sock.floor && sock.floor.userId !== myUserId;
  const iAmSpeaking = sock.floor?.userId === myUserId;

  function startTalking() {
    const reason = speechUnavailableReason();
    if (reason) return setLocalError(reason);
    if (floorHeldByOther) return;
    setLocalError(null);
    sock.acquireFloor();
    stt.start();
  }
  function stopTalking() {
    if (!iAmSpeaking && !stt.listening) return;
    stt.stop();
    const text = transcriptRef.current.trim();
    if (text) sock.sendTranscript(text);
    sock.releaseFloor();
  }

  function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    sock.setHand(next);
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    sock.sendChat(text);
    setChatInput('');
  }

  async function leave(end: boolean) {
    if (end && isHost) {
      try {
        await meetingApi.end(code);
      } catch {
        /* ignore */
      }
    }
    navigate('/home');
  }

  // Merge socket roster (authoritative presence) with LiveKit media.
  const lkById = new Map(lk.tiles.map((t) => [t.identity, t]));
  const roster =
    sock.participants.length > 0
      ? sock.participants
      : [{ userId: myUserId, name: myName, language: myLang, role: join.self.role, handRaised }];
  const error = localError || sock.error || lk.error;

  return (
    <div className="flex h-full flex-1 flex-col bg-ink-950">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-ink-900/80 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{title}</p>
          <p className="text-[11px] text-white/40">
            Code {code} · {sock.connected ? 'connected' : 'connecting…'}
          </p>
        </div>
        {isHost && (
          <span className="rounded-full bg-electric/20 px-2 py-0.5 text-[10px] font-semibold text-electric-light">HOST</span>
        )}
        <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs">
          <Users size={13} /> {roster.length}
        </span>
      </div>

      {/* Participant tiles */}
      <div className="flex gap-2 overflow-x-auto border-b border-white/5 px-3 py-2.5 no-scrollbar">
        {roster.map((p) => {
          const media = lkById.get(p.userId);
          const speaking = sock.floor?.userId === p.userId || media?.isSpeaking;
          const isMe = p.userId === myUserId;
          return (
            <div
              key={p.userId}
              className={cn(
                'relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-ink-700 transition',
                speaking ? 'border-brandgreen shadow-glow-green' : 'border-white/10',
              )}
            >
              {media?.videoTrack ? (
                <VideoTile track={media.videoTrack} mirror={isMe} />
              ) : (
                <TilePlaceholder name={p.name} color={colorFor(p.userId)} />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3">
                <span className="text-xs">{getLanguage(p.language).flag}</span>
                <span className="truncate text-[10px] font-medium text-white">{isMe ? `${p.name} (You)` : p.name}</span>
                {media && !media.micEnabled && <MicOff size={11} className="ml-auto text-red-400" />}
              </div>
              {p.handRaised && (
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-ink-900">
                  <Hand size={13} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-ink-800">
          {lk.screenTrack ? (
            <>
              <VideoTile track={lk.screenTrack} contain />
              <span className="absolute left-3 top-3 rounded-full bg-brandgreen/90 px-2.5 py-1 text-[11px] font-semibold">
                Screen sharing
              </span>
            </>
          ) : (
            <TranscriptFeed transcripts={sock.transcripts} displayText={displayText} myLang={myLang} endRef={feedEndRef} />
          )}
        </div>

        {lk.screenTrack && (
          <div className="h-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-ink-800">
            <TranscriptFeed transcripts={sock.transcripts} displayText={displayText} myLang={myLang} endRef={feedEndRef} compact />
          </div>
        )}
      </div>

      {!lk.available && (
        <p className="px-4 pb-1 text-center text-[11px] text-white/40">
          Audio/video is off (LiveKit not configured) — live translated transcript &amp; chat are active.
        </p>
      )}

      {error && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => {
              setLocalError(null);
              sock.setError(null);
              lk.setError(null);
            }}
            className="text-red-200/70"
          >
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
          disabled={floorHeldByOther}
          className={cn(
            'flex w-full touch-none select-none items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold transition',
            iAmSpeaking
              ? 'bg-red-500 text-white shadow-glow'
              : floorHeldByOther
                ? 'bg-white/5 text-white/40'
                : 'bg-brand-gradient text-white shadow-glow',
          )}
        >
          {iAmSpeaking ? (
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
          ) : floorHeldByOther ? (
            <>{sock.floor?.name} is speaking…</>
          ) : (
            <>
              <Mic size={18} /> Hold to speak
            </>
          )}
        </button>
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto px-3 py-3 no-scrollbar">
        <Control
          label="Camera"
          active={lk.cameraOn}
          disabled={!lk.available}
          onClick={lk.toggleCamera}
          icon={lk.cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
        />
        <Control
          label="Mic"
          active={lk.micOn}
          disabled={!lk.available}
          onClick={lk.toggleMic}
          icon={lk.micOn ? <Mic size={20} /> : <MicOff size={20} />}
        />
        <Control
          label="Share"
          active
          highlight={lk.sharing}
          disabled={!lk.available}
          onClick={lk.toggleScreenShare}
          icon={lk.sharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
        />
        <Control label="Hand" active highlight={handRaised} onClick={toggleHand} icon={<Hand size={20} />} />
        <Control label="Chat" active onClick={() => setChatOpen(true)} icon={<MessageSquare size={20} />} />
        <Control label="Settings" active onClick={() => setSettingsOpen(true)} icon={<SettingsIcon size={20} />} />
        <Control label={isHost ? 'End' : 'Leave'} danger onClick={() => leave(isHost)} icon={<PhoneOff size={20} />} />
      </div>

      {/* Meeting chat — translated into each participant's language */}
      <Modal open={chatOpen} onClose={() => setChatOpen(false)} title="Meeting chat">
        <div className="mb-3 flex max-h-72 min-h-[8rem] flex-col gap-2 overflow-y-auto no-scrollbar">
          {sock.chat.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">No messages yet.</p>
          ) : (
            sock.chat.map((m) => (
              <div key={m.id} className="glass rounded-xl px-3 py-2 text-sm">
                <div className="mb-0.5 flex items-center gap-2 text-[11px] text-white/40">
                  <span className="font-semibold text-electric-light">{m.senderId === myUserId ? 'You' : m.senderName}</span>
                  <span>{getLanguage(m.originalLanguage).flag}</span>
                  <span className="ml-auto">{formatTime(m.createdAt)}</span>
                </div>
                <p dir={getLanguage(m.originalLanguage === myLang || m.senderId === myUserId ? m.originalLanguage : myLang).rtl ? 'rtl' : 'ltr'}>
                  {displayText(m)}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder={`Message in ${myLangMeta.short}…`}
            className="input-field flex-1"
          />
          <button onClick={sendChat} className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient">
            <Send size={18} />
          </button>
        </div>
      </Modal>

      {/* In-meeting settings */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Meeting settings">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/70">Your language</span>
            <span className="flex items-center gap-1.5 font-medium">
              {myLangMeta.flag} {myLangMeta.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Audio / video</span>
            <span className="font-medium">{lk.available ? (lk.connected ? 'Connected' : 'Connecting…') : 'Disabled'}</span>
          </div>
          <p className="flex items-start gap-2 pt-1 text-xs text-white/40">
            <Languages size={14} className="mt-0.5 shrink-0" />
            Everyone's speech and chat is translated into your language automatically. To change your
            language, leave and rejoin with it selected.
          </p>
        </div>
      </Modal>
    </div>
  );
}

// ---- Sub-components --------------------------------------------------------

function VideoTile({ track, mirror, contain }: { track: Track; mirror?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn('h-full w-full', contain ? 'bg-black object-contain' : 'object-cover', mirror && '-scale-x-100')}
    />
  );
}

function TilePlaceholder({ name, color }: { name: string; color: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${color}55, ${color}22)` }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
      >
        {initials}
      </span>
    </div>
  );
}

function TranscriptFeed({
  transcripts,
  displayText,
  myLang,
  endRef,
  compact,
}: {
  transcripts: RoomMessage[];
  displayText: (m: RoomMessage) => string;
  myLang: string;
  endRef: React.RefObject<HTMLDivElement>;
  compact?: boolean;
}) {
  if (transcripts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white/40">
        <Mic size={compact ? 22 : 34} className="mb-2 opacity-40" />
        <p className={cn('font-medium', compact && 'text-sm')}>Live translation</p>
        {!compact && <p className="mt-1 text-sm">Hold “Hold to speak” to talk — everyone reads it in their language.</p>}
      </div>
    );
  }
  return (
    <div className={cn('h-full space-y-2 overflow-y-auto p-3 no-scrollbar', compact && 'space-y-1.5 p-2')}>
      {transcripts.map((u) => {
        const origMeta = getLanguage(u.originalLanguage);
        const translated = displayText(u);
        const showOriginal = u.originalLanguage && u.originalLanguage !== myLang;
        return (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-xl bg-white/5 p-2.5', compact && 'p-2 text-sm')}
          >
            <p className="mb-0.5 text-[11px] text-white/40">
              <span className="font-semibold text-white/70">{u.senderName}</span> spoke in {origMeta.name}
            </p>
            {showOriginal && (
              <p dir={origMeta.rtl ? 'rtl' : 'ltr'} className="text-sm text-white/60">
                {u.originalText}
              </p>
            )}
            <p dir={getLanguage(myLang).rtl ? 'rtl' : 'ltr'} className="mt-0.5 font-medium text-electric-light">
              {translated}
            </p>
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
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  highlight?: boolean;
  disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex shrink-0 flex-col items-center gap-1 disabled:opacity-40">
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
