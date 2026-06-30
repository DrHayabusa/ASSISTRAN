import { pool } from './pool';

/**
 * Idempotent schema creation. Runs on startup so a fresh MariaDB just works.
 * For a larger project this would be replaced by a real migration tool, but
 * CREATE TABLE IF NOT EXISTS is enough for this app's stable schema.
 */
const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    username VARCHAR(60) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    preferred_language VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_username (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS meetings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    host_user_id CHAR(36) NOT NULL,
    status ENUM('scheduled','live','ended') NOT NULL DEFAULT 'live',
    scheduled_for DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    UNIQUE KEY uq_meetings_code (code),
    KEY idx_meetings_host (host_user_id),
    CONSTRAINT fk_meetings_host FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS meeting_participants (
    id CHAR(36) NOT NULL PRIMARY KEY,
    meeting_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL,
    display_name VARCHAR(120) NOT NULL,
    preferred_language VARCHAR(40) NOT NULL DEFAULT '',
    role ENUM('host','participant') NOT NULL DEFAULT 'participant',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME NULL,
    KEY idx_mp_meeting (meeting_id),
    KEY idx_mp_user (user_id),
    CONSTRAINT fk_mp_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS messages (
    id CHAR(36) NOT NULL PRIMARY KEY,
    meeting_id CHAR(36) NOT NULL,
    sender_user_id CHAR(36) NULL,
    sender_name VARCHAR(120) NOT NULL,
    kind ENUM('chat','transcript') NOT NULL DEFAULT 'chat',
    original_text TEXT NOT NULL,
    original_language VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_msg_meeting (meeting_id, created_at),
    CONSTRAINT fk_msg_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export async function migrate(): Promise<void> {
  for (const sql of STATEMENTS) {
    await pool.query(sql);
  }
}
