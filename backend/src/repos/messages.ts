import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';

export interface MessageRow {
  id: string;
  meeting_id: string;
  sender_user_id: string | null;
  sender_name: string;
  kind: 'chat' | 'transcript';
  original_text: string;
  original_language: string;
  created_at: Date;
}

export async function addMessage(input: {
  meetingId: string;
  senderUserId: string | null;
  senderName: string;
  kind: 'chat' | 'transcript';
  originalText: string;
  originalLanguage: string;
}): Promise<MessageRow> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO messages (id, meeting_id, sender_user_id, sender_name, kind, original_text, original_language)
     VALUES (:id, :m, :su, :sn, :kind, :txt, :lang)`,
    {
      id,
      m: input.meetingId,
      su: input.senderUserId,
      sn: input.senderName,
      kind: input.kind,
      txt: input.originalText,
      lang: input.originalLanguage,
    },
  );
  return {
    id,
    meeting_id: input.meetingId,
    sender_user_id: input.senderUserId,
    sender_name: input.senderName,
    kind: input.kind,
    original_text: input.originalText,
    original_language: input.originalLanguage,
    created_at: new Date(),
  };
}

/** Most recent chat messages for a meeting, oldest-first. */
export async function recentChat(meetingId: string, limit = 50): Promise<MessageRow[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 200); // integer we control — safe to inline
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM messages WHERE meeting_id = :m AND kind = 'chat' ORDER BY created_at DESC LIMIT ${safeLimit}`,
    { m: meetingId },
  );
  return (rows as unknown as MessageRow[]).reverse();
}
