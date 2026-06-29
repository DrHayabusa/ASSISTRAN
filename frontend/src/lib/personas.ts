import type { Friend } from '../types';
import { friendsStore } from './storage';

/**
 * Demo personas used to SIMULATE other users for local testing. In a real
 * deployment these would be real accounts reached over a socket/WebRTC layer.
 * Each persona has a few canned replies written in their own language so the
 * round-trip translation (their language -> your language) can be demonstrated.
 */
export interface Persona extends Friend {
  /** Short character description used to give the AI persona flavour. */
  bio: string;
  /** Canned lines used only as a fallback when the AI reply endpoint fails. */
  replies: string[];
}

export const DEMO_PERSONAS: Persona[] = [
  {
    username: 'sofia',
    name: 'Sofía Morales',
    preferredLanguage: 'spanish',
    online: true,
    avatarColor: '#ec4899',
    bio: 'a friendly product designer from Madrid who loves football, travel and good coffee',
    replies: [
      '¡Hola! ¿Cómo estás?',
      'Claro, me parece bien.',
      'Perfecto, hablamos luego.',
      '¡Gracias por avisar!',
      'Nos vemos pronto.',
    ],
  },
  {
    username: 'kenji',
    name: 'Kenji Tanaka',
    preferredLanguage: 'japanese',
    online: false,
    avatarColor: '#3b82f6',
    bio: 'a polite software engineer from Tokyo who enjoys hiking, ramen and photography',
    replies: ['こんにちは！元気ですか？', '了解しました。', 'また後で話しましょう。', 'ありがとうございます！', 'いいですね。'],
  },
  {
    username: 'liang',
    name: 'Liang Wei',
    preferredLanguage: 'mandarin-chinese',
    online: true,
    avatarColor: '#10b981',
    bio: 'an easy-going marketing manager from Shanghai who loves street food, movies and basketball',
    replies: ['你好！最近怎么样？', '好的，没问题。', '稍后聊。', '谢谢你的消息！', '听起来不错。'],
  },
];

/** Persona that arrives as an incoming friend request (to demo the accept flow). */
export const REQUEST_PERSONA: Persona = {
  username: 'amir',
  name: 'Amir Al Falasi',
  preferredLanguage: 'emirati-arabic',
  online: true,
  avatarColor: '#f59e0b',
  bio: 'a warm entrepreneur from Dubai who enjoys cars, family time and trying new restaurants',
  replies: ['هلا! شخبارك؟', 'تمام، عيل زين.', 'نتواصل بعدين.', 'مشكور على الخبر!', 'حلو، يالله.'],
};

const ALL = [...DEMO_PERSONAS, REQUEST_PERSONA];

export function getPersona(username: string): Persona | undefined {
  return ALL.find((p) => p.username.toLowerCase() === username.toLowerCase());
}

/** Pick a random canned reply for a persona, defaulting to a friendly generic line. */
export function randomReply(username: string): string {
  const p = getPersona(username);
  if (!p || p.replies.length === 0) return '👍';
  return p.replies[Math.floor(Math.random() * p.replies.length)];
}

/** Strip persona-only fields so we can store a plain Friend. */
function toFriend(p: Persona): Friend {
  return {
    username: p.username,
    name: p.name,
    preferredLanguage: p.preferredLanguage,
    online: p.online,
    avatarColor: p.avatarColor,
  };
}

/**
 * On first use, give the account some demo friends to chat with and one
 * pending incoming friend request to demonstrate the accept flow.
 */
export function seedSocialIfEmpty(userId: string): void {
  const friends = friendsStore.all(userId);
  const requests = friendsStore.requests(userId);
  if (friends.length === 0 && requests.length === 0) {
    friendsStore.save(userId, DEMO_PERSONAS.map(toFriend));
    friendsStore.saveRequests(userId, [
      {
        fromUsername: REQUEST_PERSONA.username,
        fromName: REQUEST_PERSONA.name,
        preferredLanguage: REQUEST_PERSONA.preferredLanguage,
        avatarColor: REQUEST_PERSONA.avatarColor,
        createdAt: Date.now(),
      },
    ]);
  }
}

const FALLBACK_LANGS = ['spanish', 'french', 'hindi', 'portuguese', 'russian', 'tamil'];
const FALLBACK_COLORS = ['#8b5cf6', '#06b6d4', '#ef4444', '#f59e0b', '#10b981'];

/**
 * Simulate adding a friend by username. If the username matches a known demo
 * persona we use their details; otherwise we fabricate a plausible new contact.
 * Returns the created friend (or null if they are already in the list).
 */
export function addFriendByUsername(userId: string, rawUsername: string): Friend | null {
  const username = rawUsername.trim().toLowerCase().replace(/^@/, '');
  if (!username) return null;
  const existing = friendsStore.all(userId);
  if (existing.some((f) => f.username === username)) return null;

  const persona = getPersona(username);
  const friend: Friend = persona
    ? toFriend(persona)
    : {
        username,
        name: username.charAt(0).toUpperCase() + username.slice(1),
        preferredLanguage: FALLBACK_LANGS[Math.floor(Math.random() * FALLBACK_LANGS.length)],
        online: Math.random() > 0.5,
        avatarColor: FALLBACK_COLORS[Math.floor(Math.random() * FALLBACK_COLORS.length)],
      };

  friendsStore.save(userId, [friend, ...existing]);
  return friend;
}
