import { motion } from 'framer-motion';
import { Clock, LogIn, MessageSquare, Mic, Settings as SettingsIcon, Video } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LanguageDropdown } from '../components/ui/LanguageDropdown';
import { Avatar } from '../components/ui/Avatar';
import { colorFor } from '../lib/utils';
import NewMeetingModal from './meeting/NewMeetingModal';
import JoinMeetingModal from './meeting/JoinMeetingModal';

interface Tile {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  onClick: () => void;
}

/** The main app home screen: user info, a 2x2 action grid, and quick links. */
export default function Home() {
  const navigate = useNavigate();
  const { user, setPreferredLanguage } = useApp();
  const [newOpen, setNewOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  if (!user) return null;

  const tiles: Tile[] = [
    {
      key: 'new',
      title: 'New Meeting',
      description: 'Host a live translated call',
      icon: <Video size={26} />,
      gradient: 'from-electric/30 to-electric/5',
      onClick: () => setNewOpen(true),
    },
    {
      key: 'join',
      title: 'Join Meeting',
      description: 'Enter a code to join',
      icon: <LogIn size={26} />,
      gradient: 'from-brandgreen/30 to-brandgreen/5',
      onClick: () => setJoinOpen(true),
    },
    {
      key: 'chats',
      title: 'Chats',
      description: 'Message in any language',
      icon: <MessageSquare size={26} />,
      gradient: 'from-purple-500/30 to-purple-500/5',
      onClick: () => navigate('/chats'),
    },
    {
      key: 'translate',
      title: 'Translate',
      description: 'Quick voice & text',
      icon: <Mic size={26} />,
      gradient: 'from-amber-500/30 to-amber-500/5',
      onClick: () => navigate('/translate'),
    },
  ];

  return (
    <div className="flex flex-1 flex-col px-5 pb-6 pt-8">
      {/* App name */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="bg-gradient-to-r from-white to-electric-light bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
          ASSISTRAN
        </h1>
        <button
          onClick={() => navigate('/settings')}
          className="rounded-full p-2 text-white/70 transition hover:bg-white/10"
          aria-label="Settings"
        >
          <SettingsIcon size={22} />
        </button>
      </div>

      {/* User info + language switcher */}
      <div className="glass-card mb-7 flex items-center gap-3 p-3.5">
        <Avatar name={user.name} color={colorFor(user.username)} size="md" online />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{user.name}</p>
          <p className="truncate text-xs text-white/50">Speaks &amp; understands</p>
        </div>
        <LanguageDropdown value={user.preferredLanguage} onChange={setPreferredLanguage} compact />
      </div>

      {/* 2x2 action grid */}
      <div className="grid grid-cols-2 gap-4">
        {tiles.map((tile, i) => (
          <motion.button
            key={tile.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={tile.onClick}
            className={`glass-card relative flex aspect-square flex-col items-start justify-between bg-gradient-to-br p-4 text-left ${tile.gradient}`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
              {tile.icon}
            </span>
            <div>
              <p className="font-bold leading-tight">{tile.title}</p>
              <p className="mt-0.5 text-xs text-white/50">{tile.description}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <QuickLink icon={<Clock size={20} />} label="History" onClick={() => navigate('/history')} />
        <QuickLink icon={<SettingsIcon size={20} />} label="Settings" onClick={() => navigate('/settings')} />
      </div>

      <footer className="mt-auto pt-8 text-center text-[11px] text-white/30">
        All rights reserved by Assistran™ 2026
      </footer>

      <NewMeetingModal open={newOpen} onClose={() => setNewOpen(false)} />
      <JoinMeetingModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}

function QuickLink({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="glass flex items-center justify-center gap-2.5 rounded-2xl py-3.5 font-medium text-white/80"
    >
      <span className="text-electric-light">{icon}</span>
      {label}
    </motion.button>
  );
}
