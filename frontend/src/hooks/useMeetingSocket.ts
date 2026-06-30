import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '../lib/api';

export interface RoomParticipant {
  userId: string;
  name: string;
  language: string;
  role: 'host' | 'participant';
  handRaised: boolean;
}

export interface RoomMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  originalText: string;
  originalLanguage: string;
  createdAt: number;
}

export type FloorHolder = { userId: string; name: string } | null;

interface Options {
  code: string;
  displayName: string;
  language: string;
}

/**
 * Connects to the meeting's realtime room over Socket.IO and exposes shared
 * state (participants, chat, live transcripts, floor) plus actions. Transport
 * only — translation of incoming text happens in the component, per listener.
 */
export function useMeetingSocket({ code, displayName, language }: Options) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [chat, setChat] = useState<RoomMessage[]>([]);
  const [transcripts, setTranscripts] = useState<RoomMessage[]>([]);
  const [floor, setFloor] = useState<FloorHolder>(null);
  const [self, setSelf] = useState<{ userId: string; name: string; language: string; role: 'host' | 'participant' } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io', auth: { token: getToken() }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const join = () => socket.emit('room:join', { code, displayName, language });

    socket.on('connect', () => {
      setConnected(true);
      join(); // (re)join on every (re)connect
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (e: Error) =>
      setError(e.message === 'unauthorized' ? 'Session expired — please sign in again.' : 'Realtime connection failed.'),
    );
    socket.on('room:error', (p: { error: string }) => setError(p.error));
    socket.on(
      'room:state',
      (s: {
        self: { userId: string; name: string; language: string; role: 'host' | 'participant' };
        participants: RoomParticipant[];
        floor: FloorHolder;
        chat: RoomMessage[];
      }) => {
        setSelf(s.self);
        setParticipants(s.participants ?? []);
        setFloor(s.floor ?? null);
        setChat(s.chat ?? []);
      },
    );
    socket.on('room:participants', (list: RoomParticipant[]) => setParticipants(list ?? []));
    socket.on('chat:new', (m: RoomMessage) => setChat((c) => [...c, m]));
    socket.on('transcript:new', (t: RoomMessage) => setTranscripts((arr) => [...arr.slice(-39), t]));
    socket.on('floor:update', (f: FloorHolder) => setFloor(f));
    socket.on('floor:denied', (f: { name: string }) => setError(`${f.name} currently has the floor.`));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, displayName, language]);

  const sendChat = useCallback((text: string) => socketRef.current?.emit('chat:send', { text, language }), [language]);
  const sendTranscript = useCallback(
    (text: string) => socketRef.current?.emit('transcript:send', { text, language }),
    [language],
  );
  const setHand = useCallback((raised: boolean) => socketRef.current?.emit('hand:set', { raised }), []);
  const acquireFloor = useCallback(() => socketRef.current?.emit('floor:acquire'), []);
  const releaseFloor = useCallback(() => socketRef.current?.emit('floor:release'), []);

  return {
    connected,
    participants,
    chat,
    transcripts,
    floor,
    self,
    error,
    setError,
    sendChat,
    sendTranscript,
    setHand,
    acquireFloor,
    releaseFloor,
  };
}
