import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Languages, Lock, User as UserIcon, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';

type Mode = 'login' | 'signup';

/** Login + create-account screen backed by local storage. */
export default function Onboarding() {
  const navigate = useNavigate();
  const { login, signup } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (password !== confirm) return setError('Passwords do not match.');
      if (password.length < 4) return setError('Password must be at least 4 characters.');
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const res = await login(username, password);
        if (!res.ok) return setError(res.error ?? 'Login failed.');
        // Existing users may already have a language; the guard routes correctly.
        navigate('/home');
      } else {
        const res = await signup({ name, username, password });
        if (!res.ok) return setError(res.error ?? 'Could not create account.');
        navigate('/language');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
          <Languages size={32} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Welcome to ASSISTRAN</h1>
        <p className="mt-1 text-sm text-white/50">
          {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-6 flex rounded-2xl bg-ink-700/70 p-1">
        {(['login', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              'relative flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
              mode === m ? 'text-white' : 'text-white/50',
            )}
          >
            {mode === m && (
              <motion.span
                layoutId="auth-tab"
                className="absolute inset-0 rounded-xl bg-brand-gradient"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              />
            )}
            <span className="relative">{m === 'login' ? 'Login' : 'Sign Up'}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <Field icon={<UserIcon size={18} />} label="Full name">
            <input
              className="input-field pl-11"
              placeholder="e.g. Ahmed Ali"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </Field>
        )}

        <Field icon={<UserPlus size={18} />} label="Username">
          <input
            className="input-field pl-11"
            placeholder="Choose a unique username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
          />
        </Field>

        <Field icon={<Lock size={18} />} label="Password">
          <input
            type="password"
            className="input-field pl-11"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>

        {mode === 'signup' && (
          <Field icon={<Lock size={18} />} label="Confirm password">
            <input
              type="password"
              className="input-field pl-11"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary mt-2">
          {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
          {!busy && <ArrowRight size={18} />}
        </button>
      </form>

      <p className="mt-auto pt-6 text-center text-xs text-white/30">
        Accounts are stored locally on this device for testing.
      </p>
    </div>
  );
}

/** Labeled input wrapper with a leading icon. */
function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-text">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
          {icon}
        </span>
        {children}
      </div>
    </label>
  );
}
