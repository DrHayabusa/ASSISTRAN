import { motion } from 'framer-motion';
import { Clock, LogIn, MessageSquare, Mic, Trash2, Video } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { historyStore } from '../lib/storage';
import type { HistoryItem, HistoryType } from '../types';
import { formatDateTime } from '../lib/utils';

const META: Record<HistoryType, { icon: React.ReactNode; label: string; color: string }> = {
  meeting_created: { icon: <Video size={18} />, label: 'Meeting created', color: 'text-electric-light' },
  meeting_joined: { icon: <LogIn size={18} />, label: 'Meeting joined', color: 'text-brandgreen' },
  chat: { icon: <MessageSquare size={18} />, label: 'Chat', color: 'text-purple-400' },
  translation: { icon: <Mic size={18} />, label: 'Translation', color: 'text-amber-400' },
};

/** Activity history page (meetings, chats, translations). */
export default function History() {
  const { user } = useApp();
  const [items, setItems] = useState<HistoryItem[]>(() => (user ? historyStore.all(user.id) : []));

  function clearAll() {
    if (!user) return;
    historyStore.clear(user.id);
    setItems([]);
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="History"
        subtitle="Your recent activity"
        backTo="/home"
        right={
          items.length > 0 ? (
            <button
              onClick={clearAll}
              className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-red-300"
              aria-label="Clear history"
            >
              <Trash2 size={18} />
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 no-scrollbar">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-white/40">
            <Clock size={48} className="mb-3 opacity-40" />
            <p className="font-medium">No activity yet</p>
            <p className="mt-1 text-sm">Meetings, chats and translations will show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((item, i) => {
              const meta = META[item.type];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass flex items-center gap-3 rounded-2xl p-3.5"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ${meta.color}`}>
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.title}</p>
                    {item.detail && <p className="truncate text-xs text-white/50">{item.detail}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-white/40">{meta.label}</p>
                    <p className="text-[11px] text-white/30">{formatDateTime(item.timestamp)}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
