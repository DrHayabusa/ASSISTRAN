import { Calendar, Check, Copy, Link2, Play, Video } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../context/AppContext';
import { meetingsStore } from '../../lib/storage';
import { makeMeetingCode, uid } from '../../lib/utils';
import { cn } from '../../lib/utils';

type Mode = 'now' | 'schedule';

/** Modal for creating an instant meeting or scheduling one for later. */
export default function NewMeetingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user, logActivity } = useApp();
  const [mode, setMode] = useState<Mode>('now');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = code ? `${window.location.origin}/meeting/${code}/setup` : '';

  function reset() {
    setMode('now');
    setTitle('');
    setWhen('');
    setCode(null);
    setCopied(false);
  }

  function close() {
    reset();
    onClose();
  }

  function create() {
    if (!user) return;
    const meetingTitle = title.trim() || 'ASSISTRAN Meeting';
    const newCode = makeMeetingCode();
    meetingsStore.add(user.id, {
      id: uid('mtg_'),
      code: newCode,
      title: meetingTitle,
      scheduledFor: mode === 'schedule' && when ? new Date(when).getTime() : undefined,
      createdBy: user.username,
      createdAt: Date.now(),
    });
    logActivity({
      type: 'meeting_created',
      title: meetingTitle,
      detail: mode === 'schedule' && when ? `Scheduled · ${new Date(when).toLocaleString()}` : `Code ${newCode}`,
    });
    setCode(newCode);
  }

  function copy() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function start() {
    if (!code) return;
    const meetingTitle = title.trim() || 'ASSISTRAN Meeting';
    close();
    navigate(`/meeting/${code}/setup`, { state: { title: meetingTitle, isHost: true } });
  }

  return (
    <Modal open={open} onClose={close} title="New Meeting">
      {!code ? (
        <>
          {/* Mode tabs */}
          <div className="mb-4 flex rounded-2xl bg-ink-700/70 p-1">
            {(
              [
                { k: 'now', label: 'Start now', icon: <Video size={16} /> },
                { k: 'schedule', label: 'Schedule', icon: <Calendar size={16} /> },
              ] as { k: Mode; label: string; icon: React.ReactNode }[]
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setMode(t.k)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
                  mode === t.k ? 'bg-brand-gradient text-white' : 'text-white/50',
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <label className="mb-3 block">
            <span className="label-text">Meeting title</span>
            <input
              className="input-field"
              placeholder="e.g. Sales sync with Madrid"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          {mode === 'schedule' && (
            <label className="mb-3 block">
              <span className="label-text">Date &amp; time</span>
              <input
                type="datetime-local"
                className="input-field"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </label>
          )}

          <button onClick={create} className="btn-primary mt-2 w-full">
            <Link2 size={18} /> {mode === 'schedule' ? 'Schedule & get link' : 'Create meeting'}
          </button>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-white/60">Share this link or code with participants:</p>

          <div className="glass mb-3 rounded-2xl p-4 text-center">
            <p className="text-xs text-white/40">Meeting code</p>
            <p className="text-2xl font-extrabold tracking-widest text-electric-light">{code}</p>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-ink-700/70 p-2">
            <span className="truncate px-2 text-sm text-white/60">{link}</span>
            <button
              onClick={copy}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium transition active:scale-95"
            >
              {copied ? <Check size={15} className="text-brandgreen" /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <button onClick={start} className="btn-primary w-full">
            <Play size={18} /> Start meeting
          </button>
          <button onClick={close} className="mt-2 w-full py-2 text-sm text-white/50">
            Done — I'll start later
          </button>
        </>
      )}
    </Modal>
  );
}
