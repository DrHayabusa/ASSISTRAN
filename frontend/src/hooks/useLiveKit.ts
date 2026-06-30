import { useCallback, useEffect, useRef, useState } from 'react';
import { type Participant, type RemoteTrack, Room, RoomEvent, Track, type TrackPublication } from 'livekit-client';

export interface LkTile {
  identity: string; // == app userId (token identity)
  name: string;
  isLocal: boolean;
  videoTrack?: Track;
  isSpeaking: boolean;
  micEnabled: boolean;
}

interface Options {
  url: string | null;
  token: string | null;
  camera: boolean;
  mic: boolean;
}

/**
 * Manages a LiveKit (SFU) connection for audio/video. Returns a tile per
 * participant (camera track + speaking/mute state), the active screen-share
 * track, and device toggles. When url/token are null, A/V is disabled and the
 * meeting still works for transcript/chat.
 */
export function useLiveKit({ url, token, camera, mic }: Options) {
  const roomRef = useRef<Room | null>(null);
  const [tiles, setTiles] = useState<LkTile[]>([]);
  const [screenTrack, setScreenTrack] = useState<Track | null>(null);
  const [cameraOn, setCameraOn] = useState(camera);
  const [micOn, setMicOn] = useState(mic);
  const [sharing, setSharing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = Boolean(url && token);

  const rebuild = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const speaking = new Set(room.activeSpeakers.map((p) => p.identity));
    const out: LkTile[] = [];
    let foundScreen: Track | null = null;

    const addFor = (p: Participant, isLocal: boolean) => {
      let cam: Track | undefined;
      p.trackPublications.forEach((pub: TrackPublication) => {
        if (!pub.track) return;
        if (pub.source === Track.Source.Camera) cam = pub.track;
        if (pub.source === Track.Source.ScreenShare) foundScreen = pub.track;
      });
      out.push({
        identity: p.identity,
        name: p.name || p.identity,
        isLocal,
        videoTrack: cam,
        isSpeaking: speaking.has(p.identity),
        micEnabled: p.isMicrophoneEnabled,
      });
    };

    addFor(room.localParticipant, true);
    room.remoteParticipants.forEach((p) => addFor(p, false));
    setTiles(out);
    setScreenTrack(foundScreen);
  }, []);

  useEffect(() => {
    if (!url || !token) return;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const onChange = () => rebuild();
    const onSubscribed = (track: RemoteTrack) => {
      // Remote audio must be attached to the DOM to be heard.
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.style.display = 'none';
        el.setAttribute('data-lk-audio', '');
        document.body.appendChild(el);
      }
      rebuild();
    };
    const onUnsubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) track.detach().forEach((el) => el.remove());
      rebuild();
    };

    room
      .on(RoomEvent.ParticipantConnected, onChange)
      .on(RoomEvent.ParticipantDisconnected, onChange)
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.LocalTrackPublished, onChange)
      .on(RoomEvent.LocalTrackUnpublished, onChange)
      .on(RoomEvent.TrackMuted, onChange)
      .on(RoomEvent.TrackUnmuted, onChange)
      .on(RoomEvent.ActiveSpeakersChanged, onChange)
      .on(RoomEvent.Disconnected, () => setConnected(false));

    let cancelled = false;
    (async () => {
      try {
        await room.connect(url, token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        setConnected(true);
        await room.localParticipant.setCameraEnabled(camera).catch(() => undefined);
        await room.localParticipant.setMicrophoneEnabled(mic).catch(() => undefined);
        rebuild();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not connect to the video server.');
      }
    })();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      void room.disconnect();
      document.querySelectorAll('[data-lk-audio]').forEach((el) => el.remove());
      roomRef.current = null;
    };
    // camera/mic are read once at connect; toggles handle changes afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token, rebuild]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return setCameraOn((v) => !v);
    const next = !room.localParticipant.isCameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);
      rebuild();
    } catch {
      setError('Could not toggle the camera.');
    }
  }, [rebuild]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return setMicOn((v) => !v);
    const next = !room.localParticipant.isMicrophoneEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      rebuild();
    } catch {
      setError('Could not toggle the microphone.');
    }
  }, [rebuild]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isScreenShareEnabled;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setSharing(next);
      rebuild();
    } catch {
      setError('Screen share was cancelled or is not permitted.');
    }
  }, [rebuild]);

  return {
    available,
    connected,
    tiles,
    screenTrack,
    cameraOn,
    micOn,
    sharing,
    error,
    setError,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
  };
}
