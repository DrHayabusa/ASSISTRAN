import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { verifyToken } from '../auth/tokens';
import { findMeetingByCode, markParticipantLeft } from '../repos/meetings';
import { addMessage, recentChat, type MessageRow } from '../repos/messages';

/**
 * Realtime layer that makes one meeting code = one shared room across all users.
 * Carries presence, in-meeting chat (persisted) and live transcripts (which each
 * client translates into its own language), plus a server-authoritative
 * single-speaker "floor" lock and raise-hand state.
 *
 * Presence/floor are in-memory (fine for a single backend instance). To run
 * multiple instances, add the Socket.IO Redis adapter.
 */

interface SocketData {
  userId: string;
  username: string;
  code?: string;
  meetingId?: string;
  name?: string;
  language?: string;
  role?: 'host' | 'participant';
}

interface Presence {
  socketId: string;
  userId: string;
  name: string;
  language: string;
  role: 'host' | 'participant';
  handRaised: boolean;
}

type FloorHolder = { userId: string; name: string } | null;

const rooms = new Map<string, Map<string, Presence>>(); // code -> (socketId -> presence)
const floor = new Map<string, FloorHolder>(); // code -> current speaker

const roomKey = (code: string) => `meeting:${code}`;

/** Participant list for a room, de-duplicated by user (a user may have 2 tabs). */
function listParticipants(code: string): Presence[] {
  const room = rooms.get(code);
  if (!room) return [];
  const byUser = new Map<string, Presence>();
  for (const p of room.values()) byUser.set(p.userId, p);
  return [...byUser.values()];
}

function toChatDTO(row: MessageRow) {
  return {
    id: row.id,
    senderId: row.sender_user_id,
    senderName: row.sender_name,
    originalText: row.original_text,
    originalLanguage: row.original_language,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function initRealtime(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
  });

  // Authenticate every socket with the same JWT used for REST.
  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string) || '';
    const payload = verifyToken(token);
    if (!payload) return next(new Error('unauthorized'));
    const data = socket.data as SocketData;
    data.userId = payload.sub;
    data.username = payload.username;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on('room:join', async (payload: { code?: string; displayName?: string; language?: string }) => {
      try {
        const code = String(payload?.code || '').toUpperCase();
        if (!code) return;
        const meeting = await findMeetingByCode(code);
        if (!meeting || meeting.status === 'ended') {
          socket.emit('room:error', { error: 'Meeting not found or has ended.' });
          return;
        }

        data.code = code;
        data.meetingId = meeting.id;
        data.name = String(payload.displayName || data.username).slice(0, 120);
        data.language = payload.language || '';
        data.role = meeting.host_user_id === data.userId ? 'host' : 'participant';

        socket.join(roomKey(code));
        if (!rooms.has(code)) rooms.set(code, new Map());
        rooms.get(code)!.set(socket.id, {
          socketId: socket.id,
          userId: data.userId,
          name: data.name,
          language: data.language,
          role: data.role,
          handRaised: false,
        });

        const history = await recentChat(meeting.id).catch(() => [] as MessageRow[]);
        socket.emit('room:state', {
          self: { userId: data.userId, name: data.name, language: data.language, role: data.role },
          participants: listParticipants(code),
          floor: floor.get(code) ?? null,
          chat: history.map(toChatDTO),
        });

        socket.to(roomKey(code)).emit('room:participants', listParticipants(code));
        socket.to(roomKey(code)).emit('room:system', { text: `${data.name} joined` });
      } catch {
        socket.emit('room:error', { error: 'Could not join the room.' });
      }
    });

    // In-meeting chat: persisted, broadcast in the original language; each client
    // translates into its own preferred language on receipt.
    socket.on('chat:send', async (payload: { text?: string; language?: string }) => {
      if (!data.code || !data.meetingId) return;
      const text = String(payload?.text || '').trim();
      if (!text) return;
      try {
        const row = await addMessage({
          meetingId: data.meetingId,
          senderUserId: data.userId,
          senderName: data.name || data.username,
          kind: 'chat',
          originalText: text.slice(0, 2000),
          originalLanguage: payload.language || data.language || '',
        });
        io.to(roomKey(data.code)).emit('chat:new', toChatDTO(row));
      } catch {
        socket.emit('room:error', { error: 'Message failed to send.' });
      }
    });

    // Live speech transcript — ephemeral, fanned out for per-listener translation.
    socket.on('transcript:send', (payload: { text?: string; language?: string }) => {
      if (!data.code) return;
      const text = String(payload?.text || '').trim();
      if (!text) return;
      io.to(roomKey(data.code)).emit('transcript:new', {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: data.userId,
        senderName: data.name || data.username,
        originalText: text.slice(0, 2000),
        originalLanguage: payload.language || data.language || '',
        createdAt: Date.now(),
      });
    });

    socket.on('hand:set', (payload: { raised?: boolean }) => {
      if (!data.code) return;
      const p = rooms.get(data.code)?.get(socket.id);
      if (p) {
        p.handRaised = Boolean(payload?.raised);
        io.to(roomKey(data.code)).emit('room:participants', listParticipants(data.code));
      }
    });

    // Single-speaker floor lock (push-to-talk), server-authoritative.
    socket.on('floor:acquire', () => {
      if (!data.code) return;
      const cur = floor.get(data.code);
      if (cur && cur.userId !== data.userId) {
        socket.emit('floor:denied', cur);
        return;
      }
      floor.set(data.code, { userId: data.userId, name: data.name || data.username });
      io.to(roomKey(data.code)).emit('floor:update', floor.get(data.code));
    });

    socket.on('floor:release', () => {
      if (!data.code) return;
      const cur = floor.get(data.code);
      if (cur && cur.userId === data.userId) {
        floor.set(data.code, null);
        io.to(roomKey(data.code)).emit('floor:update', null);
      }
    });

    socket.on('disconnect', () => {
      const code = data.code;
      if (!code) return;
      rooms.get(code)?.delete(socket.id);
      const stillHere = listParticipants(code).some((p) => p.userId === data.userId);

      const cur = floor.get(code);
      if (cur && cur.userId === data.userId && !stillHere) {
        floor.set(code, null);
        io.to(roomKey(code)).emit('floor:update', null);
      }
      if (rooms.get(code)?.size === 0) rooms.delete(code);

      io.to(roomKey(code)).emit('room:participants', listParticipants(code));
      if (!stillHere && data.meetingId) {
        markParticipantLeft(data.meetingId, data.userId).catch(() => undefined);
      }
    });
  });

  return io;
}
