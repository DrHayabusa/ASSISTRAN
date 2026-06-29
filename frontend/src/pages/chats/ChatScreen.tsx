import { motion } from 'framer-motion';
import { AlertCircle, Languages, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { useApp } from '../../context/AppContext';
import { chatStore, friendsStore } from '../../lib/storage';
import { getPersona, randomReply } from '../../lib/personas';
import { getLanguage } from '../../lib/languages';
import { translate } from '../../lib/api';
import type { ChatMessage, Friend } from '../../types';
import { cn, formatTime, uid as makeId } from '../../lib/utils';

export default function ChatScreen() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const { user, logActivity } = useApp();
  const myId = user!.id;
  const myLang = user!.preferredLanguage;

  const [friend, setFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Resolve the friend (from the saved list or a known persona).
  useEffect(() => {
    let f = friendsStore.all(myId).find((x) => x.username === username) || null;
    if (!f) {
      const persona = getPersona(username);
      if (persona) {
        f = {
          username: persona.username,
          name: persona.name,
          preferredLanguage: persona.preferredLanguage,
          online: persona.online,
          avatarColor: persona.avatarColor,
        };
      }
    }
    if (!f) {
      navigate('/chats');
      return;
    }
    setFriend(f);

    const existing = chatStore.messages(myId, username);
    if (existing.length === 0) {
      // Seed a friendly opening message from the friend (in their language),
      // translated into the user's language for display.
      void seedGreeting(f);
    } else {
      setMessages(existing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, myId]);

  // Auto-scroll on new messages / typing indicator.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  function persist(next: ChatMessage[]) {
    setMessages(next);
    chatStore.save(myId, username, next);
  }

  /** Translate with a graceful fallback so the chat never hard-fails. */
  async function safeTranslate(text: string, from: string, to: string): Promise<string> {
    try {
      return await translate(text, from, to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed.');
      return text; // fall back to the original text
    }
  }

  async function seedGreeting(f: Friend) {
    const original = randomReply(f.username);
    const translated = await safeTranslate(original, f.preferredLanguage, myLang);
    const msg: ChatMessage = {
      id: makeId('m_'),
      sender: f.username,
      originalText: original,
      originalLanguage: f.preferredLanguage,
      translatedText: translated,
      targetLanguage: myLang,
      timestamp: Date.now(),
    };
    persist([msg]);
  }

  async function send() {
    const text = input.trim();
    if (!text || !friend) return;
    setInput('');
    setError(null);

    // 1) Show my message immediately (I always read my own original text).
    const mine: ChatMessage = {
      id: makeId('m_'),
      sender: 'me',
      originalText: text,
      originalLanguage: myLang,
      translatedText: text, // filled in below with the friend's-language version
      targetLanguage: friend.preferredLanguage,
      timestamp: Date.now(),
    };
    const afterMine = [...messages, mine];
    persist(afterMine);
    logActivity({ type: 'chat', title: `Chat with ${friend.name}`, detail: text.slice(0, 60) });

    // 2) Translate my message into the friend's language (what they would see).
    const forFriend = await safeTranslate(text, myLang, friend.preferredLanguage);
    const withTranslation = afterMine.map((m) => (m.id === mine.id ? { ...m, translatedText: forFriend } : m));
    persist(withTranslation);

    // 3) Simulate the friend replying in their language, translated back to mine.
    setTyping(true);
    const replyOriginal = randomReply(friend.username);
    const replyForMe = await safeTranslate(replyOriginal, friend.preferredLanguage, myLang);
    setTimeout(() => {
      setTyping(false);
      const reply: ChatMessage = {
        id: makeId('m_'),
        sender: friend.username,
        originalText: replyOriginal,
        originalLanguage: friend.preferredLanguage,
        translatedText: replyForMe,
        targetLanguage: myLang,
        timestamp: Date.now(),
      };
      persist([...withTranslation, reply]);
    }, 1100);
  }

  function toggleOriginal(id: string) {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!friend) return null;
  const friendLangMeta = getLanguage(friend.preferredLanguage);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={friend.name}
        subtitle={`${friend.online ? 'Online' : 'Offline'} · speaks ${friendLangMeta.short}`}
        backTo="/chats"
        right={<Avatar name={friend.name} color={friend.avatarColor} size="sm" online={friend.online} />}
      />

      {/* Message thread */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4 no-scrollbar">
        <div className="mx-auto mb-2 max-w-[85%] rounded-full bg-white/5 px-3 py-1 text-center text-[11px] text-white/40">
          <Languages size={12} className="mb-0.5 mr-1 inline" />
          Messages are auto-translated. You read in {getLanguage(myLang).short}; {friend.name.split(' ')[0]} reads in {friendLangMeta.short}.
        </div>

        {messages.map((m) => {
          const mine = m.sender === 'me';
          // I read my own messages as written, and the friend's messages translated into my language.
          const display = mine ? m.originalText : m.translatedText;
          const original = mine ? null : m.originalText;
          const revealed = showOriginal.has(m.id);
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn('flex', mine ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm',
                  mine ? 'rounded-br-md bg-brand-gradient text-white' : 'rounded-bl-md glass text-white',
                )}
              >
                <p dir={getLanguage(mine ? m.originalLanguage : m.targetLanguage).rtl ? 'rtl' : 'ltr'}>
                  {display}
                </p>

                {/* Friend bubbles can reveal the original-language text. */}
                {original && (
                  <>
                    {revealed && (
                      <p
                        dir={friendLangMeta.rtl ? 'rtl' : 'ltr'}
                        className="mt-1.5 border-t border-white/10 pt-1.5 text-xs text-white/50"
                      >
                        {original}
                      </p>
                    )}
                    <button
                      onClick={() => toggleOriginal(m.id)}
                      className="mt-1 text-[11px] font-medium text-electric-light"
                    >
                      {revealed ? 'Hide original' : `Show original (${friendLangMeta.short})`}
                    </button>
                  </>
                )}
                <p className={cn('mt-1 text-right text-[10px]', mine ? 'text-white/70' : 'text-white/40')}>
                  {formatTime(m.timestamp)}
                </p>
              </div>
            </motion.div>
          );
        })}

        {typing && (
          <div className="flex justify-start">
            <div className="glass flex items-center gap-1 rounded-2xl rounded-bl-md px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-white/60"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-center gap-2 border-t border-white/5 bg-ink-900/80 p-3 backdrop-blur-xl">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={`Message in ${getLanguage(myLang).short}…`}
          dir={getLanguage(myLang).rtl ? 'rtl' : 'ltr'}
          className="input-field flex-1"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gradient shadow-glow transition active:scale-90 disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
