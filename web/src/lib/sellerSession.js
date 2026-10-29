/**
 * In-memory dealer session (dealer dashboard). See lib/sessionStore.js.
 */
import { createSessionStore } from '@/lib/sessionStore';

const sellerSession = createSessionStore();

export default sellerSession;
