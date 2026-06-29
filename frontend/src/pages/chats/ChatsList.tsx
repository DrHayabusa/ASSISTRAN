import { motion } from 'framer-motion';
import { Check, Search, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { useApp } from '../../context/AppContext';
import { chatStore, friendsStore } from '../../lib/storage';
import { addFriendByUsername, seedSocialIfEmpty } from '../../lib/personas';
import { getLanguage } from '../../lib/languages';
import type { Friend, FriendRequest } from '../../types';
import { formatRelative } from '../../lib/utils';

export default function ChatsList() {
  const navigate = useNavigate();
  const { user } = useApp();
  const uid = user!.id;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // Seed demo data on first visit, then load.
  useEffect(() => {
    seedSocialIfEmpty(uid);
    setFriends(friendsStore.all(uid));
    setRequests(friendsStore.requests(uid));
  }, [uid]);

  const filtered = useMemo(
    () => friends.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())),
    [friends, search],
  );

  function lastMessagePreview(friendUsername: string): { text: string; time: number } | null {
    const msgs = chatStore.messages(uid, friendUsername);
    if (msgs.length === 0) return null;
    const last = msgs[msgs.length - 1];
    // Show the message in MY language: my own text as written, theirs translated.
    return { text: last.sender === 'me' ? last.originalText : last.translatedText, time: last.timestamp };
  }

  function acceptRequest(req: FriendRequest) {
    const newFriend: Friend = {
      username: req.fromUsername,
      name: req.fromName,
      preferredLanguage: req.preferredLanguage,
      online: true,
      avatarColor: req.avatarColor,
    };
    const nextFriends = [newFriend, ...friendsStore.all(uid)];
    const nextRequests = friendsStore.requests(uid).filter((r) => r.fromUsername !== req.fromUsername);
    friendsStore.save(uid, nextFriends);
    friendsStore.saveRequests(uid, nextRequests);
    setFriends(nextFriends);
    setRequests(nextRequests);
  }

  function declineRequest(req: FriendRequest) {
    const nextRequests = friendsStore.requests(uid).filter((r) => r.fromUsername !== req.fromUsername);
    friendsStore.saveRequests(uid, nextRequests);
    setRequests(nextRequests);
  }

  function submitAdd() {
    setAddMsg(null);
    const friend = addFriendByUsername(uid, addUsername);
    if (!friend) {
      setAddMsg('That user is already in your chats, or the username is empty.');
      return;
    }
    setFriends(friendsStore.all(uid));
    setAddUsername('');
    setAddOpen(false);
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Chats"
        subtitle="Talk in any language"
        backTo="/home"
        right={
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-full p-2 text-electric-light transition hover:bg-white/10"
            aria-label="Add friend"
          >
            <UserPlus size={20} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 no-scrollbar">
        {/* Search */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="input-field pl-11"
          />
        </div>

        {/* Pending friend requests */}
        {requests.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-white/40">
              Friend requests
            </h3>
            {requests.map((req) => (
              <div key={req.fromUsername} className="glass mb-2 flex items-center gap-3 rounded-2xl p-3">
                <Avatar name={req.fromName} color={req.avatarColor} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{req.fromName}</p>
                  <p className="truncate text-xs text-white/50">
                    @{req.fromUsername} · {getLanguage(req.preferredLanguage).name}
                  </p>
                </div>
                <button
                  onClick={() => acceptRequest(req)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brandgreen text-white active:scale-90"
                  aria-label="Accept"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => declineRequest(req)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 active:scale-90"
                  aria-label="Decline"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Friend list */}
        {filtered.length === 0 ? (
          <div className="mt-16 text-center text-white/40">
            <p className="font-medium">No chats yet</p>
            <p className="mt-1 text-sm">Tap the + icon to add a friend by username.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((friend, i) => {
              const preview = lastMessagePreview(friend.username);
              return (
                <motion.button
                  key={friend.username}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/chats/${friend.username}`)}
                  className="flex items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-white/5"
                >
                  <Avatar name={friend.name} color={friend.avatarColor} size="md" online={friend.online} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{friend.name}</p>
                      {preview && (
                        <span className="shrink-0 text-[11px] text-white/40">
                          {formatRelative(preview.time)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-white/50">
                      {preview ? preview.text : `${getLanguage(friend.preferredLanguage).flag} Speaks ${getLanguage(friend.preferredLanguage).short}`}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add friend modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a friend">
        <p className="mb-3 text-sm text-white/50">
          Enter a unique username to send a friend request. Try <span className="text-white">sofia</span>,{' '}
          <span className="text-white">kenji</span> or <span className="text-white">liang</span>.
        </p>
        <input
          value={addUsername}
          onChange={(e) => setAddUsername(e.target.value)}
          placeholder="username"
          autoCapitalize="none"
          className="input-field"
          onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
        />
        {addMsg && <p className="mt-2 text-sm text-red-300">{addMsg}</p>}
        <button onClick={submitAdd} className="btn-primary mt-4 w-full">
          <UserPlus size={18} /> Add friend
        </button>
      </Modal>
    </div>
  );
}
