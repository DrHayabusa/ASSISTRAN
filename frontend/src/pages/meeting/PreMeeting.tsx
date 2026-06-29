import { AlertCircle, Camera, CameraOff, LogIn, Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { LanguageDropdown } from '../../components/ui/LanguageDropdown';
import { Avatar } from '../../components/ui/Avatar';
import { useApp } from '../../context/AppContext';
import { cn, colorFor } from '../../lib/utils';

interface SetupState {
  title?: string;
  isHost?: boolean;
  name?: string;
}

/** Device & identity check shown to every participant before entering a room. */
export default function PreMeeting() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useApp();
  const state = (location.state ?? {}) as SetupState;

  const [name, setName] = useState(state.name || user?.name || 'Guest');
  const [lang, setLang] = useState(user?.preferredLanguage || 'british-english');
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Acquire / release the local preview stream as the toggles change.
  useEffect(() => {
    let cancelled = false;

    function stop() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function acquire() {
      stop();
      if (!camOn && !micOn) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (camOn && videoRef.current) videoRef.current.srcObject = stream;
        setError(null);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera/microphone permission was denied. Please allow access in your browser.'
            : 'Could not access your camera/microphone. You can still join without them.',
        );
        setCamOn(false);
      }
    }

    void acquire();
    return () => {
      cancelled = true;
      stop();
    };
  }, [camOn, micOn]);

  function join() {
    // Release the preview stream; the room re-acquires fresh devices.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate(`/meeting/${code}/room`, {
      state: {
        title: state.title || 'ASSISTRAN Meeting',
        isHost: state.isHost ?? false,
        name: name.trim() || 'Guest',
        lang,
        camera: camOn,
        mic: micOn,
      },
    });
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-6 pt-8">
      <div className="mb-1 text-center">
        <h1 className="text-xl font-extrabold">{state.title || 'Ready to join?'}</h1>
        <p className="mt-1 text-sm text-white/50">Meeting code: {code}</p>
      </div>

      {/* Camera preview */}
      <div className="relative my-5 aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-ink-700">
        {camOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Avatar name={name} color={colorFor(name)} size="lg" />
            <p className="text-sm text-white/50">Camera is off</p>
          </div>
        )}

        {/* Toggle buttons overlay */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-3">
          <ToggleBtn on={camOn} onClick={() => setCamOn((v) => !v)} onIcon={<Camera size={20} />} offIcon={<CameraOff size={20} />} />
          <ToggleBtn on={micOn} onClick={() => setMicOn((v) => !v)} onIcon={<Mic size={20} />} offIcon={<MicOff size={20} />} />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <label className="mb-3 block">
        <span className="label-text">Your name</span>
        <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="mb-6 flex items-center justify-between">
        <span className="label-text mb-0">Language you speak &amp; understand</span>
        <LanguageDropdown value={lang} onChange={setLang} compact />
      </div>

      <button onClick={join} className="btn-primary mt-auto w-full">
        <LogIn size={18} /> Join meeting
      </button>
    </div>
  );
}

function ToggleBtn({
  on,
  onClick,
  onIcon,
  offIcon,
}: {
  on: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition active:scale-90',
        on ? 'bg-white/15 text-white' : 'bg-red-500 text-white',
      )}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
