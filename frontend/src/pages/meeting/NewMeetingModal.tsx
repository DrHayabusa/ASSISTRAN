import { AlertCircle, Calendar, Check, Copy, Link2, Play, Video } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../context/AppContext';
import { meetingApi } from '../../lib/api';
import { cn } from '../../lib/utils';

type Mode = 'now' | 'schedule';

/** Modal for creating an instant meeting or scheduling one for later (server-backed). */
export default function NewMeetingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user, logActivity } = useApp();
  const [mode, setMode] = useState<Mode>('now');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = code ? `${window.location.origin}/meeting/${code}/setup` : '';

  function reset() {
    setMode('now');
    setTitle('');
    setWhen('');
    setCode(null);
    setCopied(false);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function create() {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      const meetingTitle = title.trim() || 'ASSISTRAN Meeting';
      const { meeting } = await meetingApi.create({
        title: meetingTitle,
        scheduledFor: mode === 'schedule' && when ? new Date(when).getTime() : null,
      });
      logActivity({
        type: 'meeting_created',
        title: meeting.title,
        detail:
          mode === 'schedule' && when ? `Scheduled · ${new Date(when).toLocaleString()}` : `Code ${meeting.code}`,
      });
      setCode(meeting.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the meeting.');
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function start() {
    if (!code) return;
    close();
    navigate(`/meeting/${code}/setup`, { state: { title: title.trim() || 'ASSISTRAN Meeting' } });
  }

  return (
    <Modal open={open} onClose={close} title="New Meeting">
      {!code ? (
        <>
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

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <button onClick={create} disabled={busy} className="btn-primary mt-2 w-full">
            <Link2 size={18} /> {busy ? 'Creating…' : mode === 'schedule' ? 'Schedule & get link' : 'Create meeting'}
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
