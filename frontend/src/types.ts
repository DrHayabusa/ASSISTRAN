// ---------------------------------------------------------------------------
// Shared domain types for the whole app.
// ---------------------------------------------------------------------------

/** A selectable language with display metadata. */
export interface Language {
  /** Stable id used in storage, e.g. "british-english". */
  id: string;
  /** Human name sent to the backend, e.g. "British English". */
  name: string;
  /** Short label for compact UI, e.g. "English". */
  short: string;
  /** Emoji flag. */
  flag: string;
  /** BCP-47 code used by the Web Speech API (recognition + synthesis). */
  speechCode: string;
  /** Whether the script is right-to-left. */
  rtl?: boolean;
}

/** A registered user. NOTE: password is stored in plaintext for LOCAL TESTING ONLY. */
export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  /** Language id of the user's preferred spoken/understood language. */
  preferredLanguage: string;
  createdAt: number;
}

/** A friend in the contact list (simulated for local testing). */
export interface Friend {
  username: string;
  name: string;
  /** Language id. */
  preferredLanguage: string;
  online: boolean;
  avatarColor: string;
}

/** An incoming friend request (simulated). */
export interface FriendRequest {
  fromUsername: string;
  fromName: string;
  preferredLanguage: string;
  avatarColor: string;
  createdAt: number;
}

/**
 * A single chat message. Each message stores BOTH the original and the
 * translated text so every participant can be shown the version in their
 * own preferred language.
 */
export interface ChatMessage {
  id: string;
  /** "me" for the current user, otherwise the friend's username. */
  sender: string;
  originalText: string;
  /** Language id the message was written in. */
  originalLanguage: string;
  translatedText: string;
  /** Language id the message was translated into for the viewer. */
  targetLanguage: string;
  timestamp: number;
}

/** A meeting created or scheduled by a user. */
export interface Meeting {
  id: string;
  code: string;
  title: string;
  /** Epoch ms when scheduled; undefined means "now". */
  scheduledFor?: number;
  createdBy: string;
  createdAt: number;
}

export type HistoryType = 'meeting_created' | 'meeting_joined' | 'chat' | 'translation';

/** An entry in the activity history. */
export interface HistoryItem {
  id: string;
  type: HistoryType;
  title: string;
  detail?: string;
  timestamp: number;
}

/** A single quick-translation record (also surfaced in history). */
export interface TranslationRecord {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
}
