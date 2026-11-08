/**
 * Socket.io client (LIV-1): one shared connection for live groups, chat and in-app
 * notifications. Authenticates with the in-memory access token; when the server says the
 * token expired, it refreshes the session and reconnects. Screens fall back to polling
 * while disconnected (see useGroupSocket).
 */
import { io, type Socket } from 'socket.io-client';

import { getAccessToken, refreshAccessToken } from '@/lib/authSession';
import { SOCKET_URL } from '@/utils/constants';

let socket: Socket | null = null;
const listeners = new Set<(connected: boolean) => void>();

/** Tell subscribers whether we are live. */
function notify(connected: boolean) {
  listeners.forEach((listener) => listener(connected));
}

/**
 * The shared socket (created and connected on first use).
 * @returns Socket instance
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    // Called on every (re)connect, so a refreshed token is always used
    auth: (callback) => callback({ token: getAccessToken() }),
  });
  socket.on('connect', () => notify(true));
  socket.on('disconnect', () => notify(false));
  socket.on('connect_error', async (error) => {
    notify(false);
    if (error.message === 'TOKEN_EXPIRED' || error.message === 'UNAUTHORIZED') {
      // Refresh once, then try again; signed-out users stay disconnected
      const token = await refreshAccessToken().catch(() => null);
      if (token) socket?.connect();
    }
  });
  return socket;
}

/** Connect when signed in (no-op if already connected). */
export function connectSocket(): void {
  if (!getAccessToken()) return;
  const client = getSocket();
  if (!client.connected) client.connect();
}

/** Disconnect on logout. */
export function disconnectSocket(): void {
  socket?.disconnect();
  notify(false);
}

/** @returns Whether the socket is connected now */
export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}

/**
 * Follow connection changes.
 * @param listener - Called with true / false
 * @returns Unsubscribe function
 */
export function onSocketConnectionChange(listener: (connected: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
