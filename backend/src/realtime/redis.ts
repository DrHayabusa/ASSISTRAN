import type { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { config } from '../config';

/**
 * Attach the Redis adapter to Socket.IO so realtime events fan out across
 * multiple backend instances. No-op (returns false) when REDIS_URL is unset.
 * Failures are non-fatal: the server falls back to the in-memory adapter.
 */
export async function attachRedisAdapter(io: Server): Promise<boolean> {
  if (!config.redisUrl) return false;
  const pub = createClient({
    url: config.redisUrl,
    // Bounded connect + limited reconnects so a missing Redis can't hang startup.
    socket: { connectTimeout: 5000, reconnectStrategy: (retries) => (retries > 5 ? false : 500) },
  });
  const sub = pub.duplicate();
  // Avoid unhandled 'error' events crashing the process if Redis blips.
  pub.on('error', () => undefined);
  sub.on('error', () => undefined);
  await Promise.all([pub.connect(), sub.connect()]);
  io.adapter(createAdapter(pub, sub));
  return true;
}
