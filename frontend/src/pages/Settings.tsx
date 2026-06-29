import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Info,
  LogOut,
  Shield,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { LanguageDropdown } from '../components/ui/LanguageDropdown';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { useApp } from '../context/AppContext';
import { cn, colorFor } from '../lib/utils';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, deleteAccount, setPreferredLanguage, updateProfile, changePassword } = useApp();
  const [open, setOpen] = useState<string | null>('profile');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!user) return null;

  const toggle = (key: string) => setOpen((cur) => (cur === key ? null : key));

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Settings" backTo="/home" />

      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4 no-scrollbar">
        {/* Profile summary */}
        <div className="glass-card mb-5 flex items-center gap-3 p-4">
          <Avatar name={user.name} color={colorFor(user.username)} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.name}</p>
            <p className="truncate text-sm text-white/50">@{user.username}</p>
          </div>
        </div>

        {/* Change preferred language (direct control) */}
        <div className="glass-card mb-3 flex items-center justify-between p-4">
          <div>
            <p className="font-semibold">Preferred language</p>
            <p className="text-xs text-white/50">Used across chats, meetings & translate</p>
          </div>
          <LanguageDropdown value={user.preferredLanguage} onChange={setPreferredLanguage} compact />
        </div>

        {/* Edit profile */}
        <Section
          icon={<UserIcon size={18} />}
          title="Edit profile"
          open={open === 'profile'}
          onToggle={() => toggle('profile')}
        >
          <EditProfile
            initialName={user.name}
            initialUsername={user.username}
            onSave={updateProfile}
          />
        </Section>

        {/* Security */}
        <Section
          icon={<ShieldCheck size={18} />}
          title="Security & password"
          open={open === 'security'}
          onToggle={() => toggle('security')}
        >
          <ChangePassword onChange={changePassword} />
        </Section>

        {/* Privacy */}
        <Section
          icon={<Shield size={18} />}
          title="Privacy"
          open={open === 'privacy'}
          onToggle={() => toggle('privacy')}
        >
          <PrivacyPanel />
        </Section>

        {/* About */}
        <Section
          icon={<Info size={18} />}
          title="About ASSISTRAN"
          open={open === 'about'}
          onToggle={() => toggle('about')}
        >
          <div className="space-y-2 text-sm text-white/60">
            <p>
              ASSISTRAN is an AI-powered live translation app for meetings, chats and quick voice
              translation. Translations are produced by a private Ollama model through a secure
              backend — your text never goes to a third-party service.
            </p>
            <p className="text-white/40">Version 1.0.0 · Speak. Translate. Connect.</p>
          </div>
        </Section>

        {/* Danger / session actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => {
              logout();
              navigate('/onboarding');
            }}
            className="btn-ghost w-full"
          >
            <LogOut size={18} /> Log out
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-3 font-semibold text-red-300 transition active:scale-[0.98]"
          >
            <Trash2 size={18} /> Delete account
          </button>
        </div>

        <p className="mt-8 text-center text-[11px] text-white/30">
          All rights reserved by Assistran™ 2026
        </p>
      </div>

      {/* Delete confirmation */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete account?">
        <p className="text-sm text-white/60">
          This permanently removes your account and all locally stored data (friends, chats,
          meetings and history) on this device. This cannot be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={() => {
              deleteAccount();
              navigate('/onboarding');
            }}
            className="flex-1 rounded-2xl bg-red-500 py-3 font-semibold text-white transition active:scale-[0.98]"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** Collapsible settings section. */
function Section({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card mb-3 overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="text-electric-light">{icon}</span>
        <span className="flex-1 font-semibold">{title}</span>
        <ChevronDown size={18} className={cn('text-white/40 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EditProfile({
  initialName,
  initialUsername,
  onSave,
}: {
  initialName: string;
  initialUsername: string;
  onSave: (patch: { name?: string; username?: string }) => { ok: boolean; error?: string };
}) {
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="space-y-3">
      <div>
        <span className="label-text">Full name</span>
        <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <span className="label-text">Username</span>
        <input
          className="input-field"
          value={username}
          autoCapitalize="none"
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      {msg && (
        <p className={cn('text-sm', msg.ok ? 'text-brandgreen' : 'text-red-300')}>{msg.text}</p>
      )}
      <button
        onClick={() => {
          const res = onSave({ name, username });
          setMsg({ ok: res.ok, text: res.ok ? 'Profile updated.' : res.error ?? 'Failed.' });
        }}
        className="btn-primary w-full"
      >
        Save changes
      </button>
    </div>
  );
}

function ChangePassword({
  onChange,
}: {
  onChange: (current: string, next: string) => { ok: boolean; error?: string };
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="space-y-3">
      <div>
        <span className="label-text">Current password</span>
        <input
          type="password"
          className="input-field"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div>
        <span className="label-text">New password</span>
        <input
          type="password"
          className="input-field"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      {msg && (
        <p className={cn('text-sm', msg.ok ? 'text-brandgreen' : 'text-red-300')}>{msg.text}</p>
      )}
      <button
        onClick={() => {
          const res = onChange(current, next);
          setMsg({ ok: res.ok, text: res.ok ? 'Password changed.' : res.error ?? 'Failed.' });
          if (res.ok) {
            setCurrent('');
            setNext('');
          }
        }}
        className="btn-primary w-full"
      >
        Update password
      </button>
    </div>
  );
}

function PrivacyPanel() {
  const [showOnline, setShowOnline] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);
  return (
    <div className="space-y-1">
      <Toggle label="Show my online status" value={showOnline} onChange={setShowOnline} />
      <Toggle label="Save activity history" value={saveHistory} onChange={setSaveHistory} />
      <p className="pt-2 text-xs text-white/40">
        All your data is stored locally on this device only.
      </p>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between py-2.5 text-left">
      <span className="text-sm text-white/80">{label}</span>
      <span className={cn('relative h-6 w-11 rounded-full transition', value ? 'bg-brandgreen' : 'bg-white/15')}>
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
            value ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
