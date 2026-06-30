import mysql from 'mysql2/promise';
import { config } from '../config';

/**
 * Shared MariaDB/MySQL connection pool. utf8mb4 is required so every supported
 * language (Arabic, Mandarin, Japanese, Tamil, …) and emoji store correctly.
 */
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  waitForConnections: true,
  charset: 'utf8mb4',
  namedPlaceholders: true,
  connectTimeout: 5000,
});

/** Verify the database is reachable (used at startup). */
export async function pingDb(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
