import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/middleware';
import {
  createMeeting,
  endMeeting,
  findMeetingByCode,
  markMeetingLive,
  upsertParticipant,
  type MeetingRow,
} from '../repos/meetings';
import { findUserById } from '../repos/users';
import { config } from '../config';
import { livekitEnabled, livekitRoomName, mintLivekitToken } from '../services/livekit';

const router = Router();

function publicMeeting(m: MeetingRow) {
  return {
    id: m.id,
    code: m.code,
    title: m.title,
    hostUserId: m.host_user_id,
    status: m.status,
    scheduledFor: m.scheduled_for ? new Date(m.scheduled_for).getTime() : null,
    createdAt: new Date(m.created_at).getTime(),
  };
}

/** Create (or schedule) a meeting. Returns the server-generated unique code. */
router.post('/meetings', requireAuth, async (req: AuthedRequest, res) => {
  const { title, scheduledFor } = (req.body ?? {}) as Record<string, unknown>;
  const meeting = await createMeeting({
    title: typeof title === 'string' && title.trim() ? title.trim() : 'ASSISTRAN Meeting',
    hostUserId: req.auth!.sub,
    scheduledFor: typeof scheduledFor === 'number' ? scheduledFor : null,
  });
  res.json({ meeting: publicMeeting(meeting) });
});

/** Look up a meeting by code (validate before showing the pre-join screen). */
router.get('/meetings/:code', requireAuth, async (req, res) => {
  const meeting = await findMeetingByCode(req.params.code.toUpperCase());
  if (!meeting || meeting.status === 'ended') {
    return res.status(404).json({ error: 'Meeting not found or has ended.' });
  }
  res.json({ meeting: publicMeeting(meeting) });
});

/**
 * Join a meeting: record the participant and (if LiveKit is configured) return
 * a LiveKit access token + server URL so the browser can connect to the SFU.
 */
router.post('/meetings/:code/join', requireAuth, async (req: AuthedRequest, res) => {
  const code = req.params.code.toUpperCase();
  const meeting = await findMeetingByCode(code);
  if (!meeting || meeting.status === 'ended') {
    return res.status(404).json({ error: 'Meeting not found or has ended.' });
  }
  const user = await findUserById(req.auth!.sub);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });

  const { displayName, preferredLanguage } = (req.body ?? {}) as Record<string, unknown>;
  const dn = typeof displayName === 'string' && displayName.trim() ? displayName.trim() : user.name;
  const pl = typeof preferredLanguage === 'string' && preferredLanguage ? preferredLanguage : user.preferred_language;
  const role: 'host' | 'participant' = meeting.host_user_id === user.id ? 'host' : 'participant';

  await upsertParticipant({ meetingId: meeting.id, userId: user.id, displayName: dn, preferredLanguage: pl, role });
  if (meeting.status === 'scheduled') await markMeetingLive(meeting.id);

  let livekit: { url: string; token: string; room: string } | null = null;
  if (livekitEnabled()) {
    const room = livekitRoomName(code);
    const token = await mintLivekitToken({ room, identity: user.id, name: dn });
    livekit = { url: config.livekit.url, token, room };
  }

  res.json({
    meeting: publicMeeting(meeting),
    self: { id: user.id, displayName: dn, preferredLanguage: pl, role },
    livekit, // null when LiveKit isn't configured — the app still works for transcript/chat
  });
});

/** Host ends the meeting for everyone. */
router.post('/meetings/:code/end', requireAuth, async (req: AuthedRequest, res) => {
  const meeting = await findMeetingByCode(req.params.code.toUpperCase());
  if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });
  if (meeting.host_user_id !== req.auth!.sub) {
    return res.status(403).json({ error: 'Only the host can end the meeting.' });
  }
  await endMeeting(meeting.id);
  res.json({ ok: true });
});

export default router;
