/**
 * In-memory staff session (admin console). See lib/sessionStore.js.
 */
import { createSessionStore } from '@/lib/sessionStore';

const staffSession = createSessionStore();

export const { getAccessToken, setAccessToken, setRefreshHandler, refreshAccessToken } =
  staffSession;

export default staffSession;
