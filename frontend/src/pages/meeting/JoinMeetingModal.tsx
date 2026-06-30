import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../context/AppContext';
import { meetingApi } from '../../lib/api';

/** Modal for joining an existing meeting by code or pasted link. */
export default function JoinMeetingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useApp();
  const [codeInput, setCodeInput] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Accept either a raw code ("ABCD-1234") or a full meeting link. */
  function normalizeCode(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/meeting\/([^/]+)/i);
    const raw = match ? match[1] : trimmed;
    return raw.toUpperCase().replace(/\s+/g, '');
  }

  async function join() {
    setError(null);
    const code = normalizeCode(codeInput);
    if (!code) return setError('Please enter a meeting code or link.');
    if (!name.trim()) return setError('Please enter your name.');
    setBusy(true);
    try {
      const { meeting } = await meetingApi.get(code);
      onClose();
      navigate(`/meeting/${meeting.code}/setup`, { state: { title: meeting.title, name } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find that meeting.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Join Meeting">
      <label className="mb-3 block">
        <span className="label-text">Meeting code or link</span>
        <input
          className="input-field"
          placeholder="ABCD-1234 or paste a link"
          autoCapitalize="characters"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
        />
      </label>

      <label className="mb-3 block">
        <span className="label-text">Your name</span>
        <input
          className="input-field"
          placeholder="How others will see you"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {error && <p className="mb-2 text-sm text-red-300">{error}</p>}

      <button onClick={join} disabled={busy} className="btn-primary mt-1 w-full">
        <LogIn size={18} /> {busy ? 'Checking…' : 'Join'}
      </button>
    </Modal>
  );
}
