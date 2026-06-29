import type {
  ChatMessage,
  Friend,
  FriendRequest,
  HistoryItem,
  Meeting,
  TranslationRecord,
  User,
} from '../types';
import { uid } from './utils';

// ---------------------------------------------------------------------------
// Tiny typed wrapper around localStorage.
// All app state lives here for local testing — no server/database required.
// ---------------------------------------------------------------------------

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — ignore for local testing */
  }
}

// ---- Keys -----------------------------------------------------------------
const K_USERS = 'assistran_users';
const K_SESSION = 'assistran_session';
const friendsKey = (uid: string) => `assistran_friends_${uid}`;
const requestsKey = (uid: string) => `assistran_requests_${uid}`;
const chatKey = (uid: string, friend: string) => `assistran_chat_${uid}_${friend}`;
const meetingsKey = (uid: string) => `assistran_meetings_${uid}`;
const historyKey = (uid: string) => `assistran_history_${uid}`;
const translationsKey = (uid: string) => `assistran_translations_${uid}`;

// ---- Users & session ------------------------------------------------------
export const usersStore = {
  all: (): User[] => read<User[]>(K_USERS, []),
  save: (users: User[]) => write(K_USERS, users),
  findByUsername: (username: string): User | undefined =>
    usersStore.all().find((u) => u.username.toLowerCase() === username.toLowerCase()),
  add: (user: User) => {
    const users = usersStore.all();
    users.push(user);
    usersStore.save(users);
  },
  update: (user: User) => {
    const users = usersStore.all().map((u) => (u.id === user.id ? user : u));
    usersStore.save(users);
  },
  remove: (id: string) => {
    usersStore.save(usersStore.all().filter((u) => u.id !== id));
  },
};

export const sessionStore = {
  get: (): string | null => read<string | null>(K_SESSION, null),
  set: (userId: string) => write(K_SESSION, userId),
  clear: () => localStorage.removeItem(K_SESSION),
};

// ---- Friends & requests ---------------------------------------------------
export const friendsStore = {
  all: (userId: string): Friend[] => read<Friend[]>(friendsKey(userId), []),
  save: (userId: string, friends: Friend[]) => write(friendsKey(userId), friends),
  requests: (userId: string): FriendRequest[] => read<FriendRequest[]>(requestsKey(userId), []),
  saveRequests: (userId: string, reqs: FriendRequest[]) => write(requestsKey(userId), reqs),
};

// ---- Chats ----------------------------------------------------------------
export const chatStore = {
  messages: (userId: string, friend: string): ChatMessage[] =>
    read<ChatMessage[]>(chatKey(userId, friend), []),
  save: (userId: string, friend: string, messages: ChatMessage[]) =>
    write(chatKey(userId, friend), messages),
};

// ---- Meetings -------------------------------------------------------------
export const meetingsStore = {
  all: (userId: string): Meeting[] => read<Meeting[]>(meetingsKey(userId), []),
  add: (userId: string, meeting: Meeting) => {
    const list = meetingsStore.all(userId);
    list.unshift(meeting);
    write(meetingsKey(userId), list);
  },
};

// ---- History --------------------------------------------------------------
export const historyStore = {
  all: (userId: string): HistoryItem[] => read<HistoryItem[]>(historyKey(userId), []),
  add: (userId: string, item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const list = historyStore.all(userId);
    list.unshift({ ...item, id: uid('h_'), timestamp: Date.now() });
    // Keep history bounded.
    write(historyKey(userId), list.slice(0, 200));
  },
  clear: (userId: string) => write(historyKey(userId), []),
};

// ---- Quick translations ---------------------------------------------------
export const translationsStore = {
  all: (userId: string): TranslationRecord[] => read<TranslationRecord[]>(translationsKey(userId), []),
  add: (userId: string, record: Omit<TranslationRecord, 'id' | 'timestamp'>) => {
    const list = translationsStore.all(userId);
    list.unshift({ ...record, id: uid('t_'), timestamp: Date.now() });
    write(translationsKey(userId), list.slice(0, 100));
  },
};

/** Remove every piece of data belonging to a user (used by "Delete account"). */
export function purgeUserData(userId: string): void {
  const prefixes = [
    friendsKey(userId),
    requestsKey(userId),
    meetingsKey(userId),
    historyKey(userId),
    translationsKey(userId),
  ];
  prefixes.forEach((k) => localStorage.removeItem(k));
  // Remove all chat threads for this user.
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`assistran_chat_${userId}_`)) localStorage.removeItem(key);
  }
}
