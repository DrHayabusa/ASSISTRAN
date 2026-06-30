import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';

export interface UserRow {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  preferred_language: string;
  created_at: Date;
}

/** The user shape sent to clients (never includes the password hash). */
export interface PublicUser {
  id: string;
  name: string;
  username: string;
  preferredLanguage: string;
}

export function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, name: u.name, username: u.username, preferredLanguage: u.preferred_language };
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM users WHERE username = :username LIMIT 1',
    { username },
  );
  return (rows as unknown as UserRow[])[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE id = :id LIMIT 1', { id });
  return (rows as unknown as UserRow[])[0] ?? null;
}

export async function createUser(input: { name: string; username: string; password: string }): Promise<UserRow> {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 10);
  await pool.query(
    `INSERT INTO users (id, name, username, password_hash, preferred_language)
     VALUES (:id, :name, :username, :passwordHash, '')`,
    { id, name: input.name, username: input.username, passwordHash },
  );
  const created = await findUserById(id);
  if (!created) throw new Error('Failed to create user');
  return created;
}

export function verifyPassword(user: UserRow, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export async function updateProfile(
  id: string,
  patch: { name?: string; username?: string; preferredLanguage?: string },
): Promise<void> {
  const sets: string[] = [];
  const params: Record<string, string> = { id };
  if (patch.name !== undefined) {
    sets.push('name = :name');
    params.name = patch.name;
  }
  if (patch.username !== undefined) {
    sets.push('username = :username');
    params.username = patch.username;
  }
  if (patch.preferredLanguage !== undefined) {
    sets.push('preferred_language = :pl');
    params.pl = patch.preferredLanguage;
  }
  if (sets.length === 0) return;
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = :id`, params);
}

export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = :ph WHERE id = :id', { ph: passwordHash, id });
}

export async function deleteUser(id: string): Promise<void> {
  await pool.query('DELETE FROM users WHERE id = :id', { id });
}
