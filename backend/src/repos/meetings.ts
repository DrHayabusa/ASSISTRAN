import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';

export interface MeetingRow {
  id: string;
  code: string;
  title: string;
  host_user_id: string;
  status: 'scheduled' | 'live' | 'ended';
  scheduled_for: Date | null;
  created_at: Date;
  ended_at: Date | null;
}

export interface ParticipantRow {
  id: string;
  meeting_id: string;
  user_id: string | null;
  display_name: string;
  preferred_language: string;
  role: 'host' | 'participant';
  joined_at: Date;
  left_at: Date | null;
}

// Unambiguous alphabet (no 0/O/1/I) for human-friendly, shareable codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(): string {
  const block = (n: number) =>
    Array.from({ length: n }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  return `${block(4)}-${block(4)}`;
}

export async function findMeetingById(id: string): Promise<MeetingRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM meetings WHERE id = :id LIMIT 1', { id });
  return (rows as unknown as MeetingRow[])[0] ?? null;
}

export async function findMeetingByCode(code: string): Promise<MeetingRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM meetings WHERE code = :code LIMIT 1', { code });
  return (rows as unknown as MeetingRow[])[0] ?? null;
}

/** Create a meeting with a server-generated, collision-checked unique code. */
export async function createMeeting(input: {
  title: string;
  hostUserId: string;
  scheduledFor?: number | null;
}): Promise<MeetingRow> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = randomUUID();
    const code = generateCode();
    try {
      await pool.query(
        `INSERT INTO meetings (id, code, title, host_user_id, status, scheduled_for)
         VALUES (:id, :code, :title, :host, :status, :sf)`,
        {
          id,
          code,
          title: input.title,
          host: input.hostUserId,
          status: input.scheduledFor ? 'scheduled' : 'live',
          sf: input.scheduledFor ? new Date(input.scheduledFor) : null,
        },
      );
      const created = await findMeetingById(id);
      if (created) return created;
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY') continue; // code clash — retry
      throw e;
    }
  }
  throw new Error('Could not allocate a unique meeting code');
}

export async function markMeetingLive(id: string): Promise<void> {
  await pool.query("UPDATE meetings SET status = 'live' WHERE id = :id AND status = 'scheduled'", { id });
}

export async function endMeeting(id: string): Promise<void> {
  await pool.query("UPDATE meetings SET status = 'ended', ended_at = NOW() WHERE id = :id", { id });
}

/** Insert or revive the participant row for a (meeting, user) pair. */
export async function upsertParticipant(input: {
  meetingId: string;
  userId: string;
  displayName: string;
  preferredLanguage: string;
  role: 'host' | 'participant';
}): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM meeting_participants WHERE meeting_id = :m AND user_id = :u LIMIT 1',
    { m: input.meetingId, u: input.userId },
  );
  const existing = (rows as unknown as { id: string }[])[0];
  if (existing) {
    await pool.query(
      `UPDATE meeting_participants
       SET display_name = :dn, preferred_language = :pl, role = :role, left_at = NULL
       WHERE id = :id`,
      { dn: input.displayName, pl: input.preferredLanguage, role: input.role, id: existing.id },
    );
  } else {
    await pool.query(
      `INSERT INTO meeting_participants (id, meeting_id, user_id, display_name, preferred_language, role)
       VALUES (:id, :m, :u, :dn, :pl, :role)`,
      {
        id: randomUUID(),
        m: input.meetingId,
        u: input.userId,
        dn: input.displayName,
        pl: input.preferredLanguage,
        role: input.role,
      },
    );
  }
}

export async function markParticipantLeft(meetingId: string, userId: string): Promise<void> {
  await pool.query(
    'UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = :m AND user_id = :u AND left_at IS NULL',
    { m: meetingId, u: userId },
  );
}
