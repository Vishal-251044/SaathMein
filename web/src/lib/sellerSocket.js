/**
 * One Socket.io connection for the dealer dashboard (live auctions). It authenticates with
 * the in-memory dealer access token; when the server rejects an expired token, the token
 * is refreshed and the socket reconnects. Components use hooks/useAuctionLive.js.
 */
import { io } from 'socket.io-client';
import sellerSession from '@/lib/sellerSession';
import { SOCKET_URL } from '@/utils/constants';

let socket = null;

/**
 * The shared dealer socket (created on first use).
 * @returns {import('socket.io-client').Socket}
 */
export const getSellerSocket = () => {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: false,
    // Read the latest token on every (re)connect
    auth: (callback) => callback({ token: sellerSession.getAccessToken() }),
  });
  socket.on('connect_error', async (error) => {
    if (error.message !== 'TOKEN_EXPIRED') return;
    try {
      await sellerSession.refreshAccessToken();
      socket.connect();
    } catch {
      // Signed out: the dashboard guard sends the dealer to login
    }
  });
  return socket;
};

/** Close the dealer socket (logout). */
export const closeSellerSocket = () => {
  socket?.disconnect();
  socket = null;
};
