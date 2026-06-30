import { AccessToken } from 'livekit-server-sdk';
import { config, livekitEnabled } from '../config';

export { livekitEnabled };

/** Deterministic LiveKit room name for a meeting code. */
export function livekitRoomName(code: string): string {
  return `assistran-${code}`;
}

/**
 * Mint a LiveKit access token granting a participant the right to join a room
 * and publish/subscribe to audio, video, screen-share and data.
 */
export async function mintLivekitToken(opts: { room: string; identity: string; name: string }): Promise<string> {
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl: '4h',
  });
  at.addGrant({
    roomJoin: true,
    room: opts.room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}
