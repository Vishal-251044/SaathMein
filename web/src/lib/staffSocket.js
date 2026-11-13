/**
 * One Socket.io connection for the admin console (live monitors and alerts). It sends the
 * in-memory staff access token; the server puts staff sockets in the `staff` room only.
 * When the token has expired it is refreshed and the socket reconnects.
 */
import { io } from 'socket.io-client';
import staffSession from '@/lib/staffSession';
import { SOCKET_URL } from '@/utils/constants';

let socket = null;

/**
 * The shared staff socket (created on first use, not yet connected).
 * @returns {import('socket.io-client').Socket}
 */
export const getStaffSocket = () => {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: false,
    auth: (callback) => callback({ token: staffSession.getAccessToken() }),
  });
  socket.on('connect_error', async (error) => {
    if (error.message !== 'TOKEN_EXPIRED') return;
    try {
      await staffSession.refreshAccessToken();
      socket.connect();
    } catch {
      // Signed out: the console guard sends staff to login
    }
  });
  return socket;
};

/** Close the staff socket (logout). */
export const closeStaffSocket = () => {
  socket?.disconnect();
  socket = null;
};
