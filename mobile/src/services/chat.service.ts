/**
 * Chat service — /groups/:id/messages (LIV-5): pages of messages, send text / photo /
 * poll, vote, pin (leader), report. Photos go straight to Cloudinary with server-signed
 * params.
 */
import type { ChatMessage, ChatPage } from '@/types/live';

import { api, unwrap } from './api';

/** One page, newest first; pass the oldest id I have to load older messages. */
export function getMessages(groupId: string, before?: string): Promise<ChatPage> {
  return unwrap(api.get(`/groups/${groupId}/messages`, { params: { before } }));
}

export interface SendMessageInput {
  text?: string;
  image?: { publicId: string; version: number; signature: string };
  poll?: { question: string; options: string[] };
}

/** Send a message. */
export async function sendMessage(groupId: string, input: SendMessageInput): Promise<ChatMessage> {
  return (await unwrap<{ message: ChatMessage }>(api.post(`/groups/${groupId}/messages`, input)))
    .message;
}

/**
 * Upload a chat photo (already resized on the phone) and return the signed upload.
 * @param groupId - Group chat
 * @param image - Local file from the image picker
 */
export async function uploadChatImage(
  groupId: string,
  image: { uri: string; mimeType: string; fileName: string },
): Promise<{ publicId: string; version: number; signature: string }> {
  const { uploadUrl, fields } = await unwrap<{
    uploadUrl: string;
    fields: Record<string, string | number>;
  }>(api.post(`/groups/${groupId}/messages/image-upload-params`));
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  // React Native FormData file part
  form.append('file', {
    uri: image.uri,
    type: image.mimeType,
    name: image.fileName,
  } as unknown as Blob);
  const response = await fetch(uploadUrl, { method: 'POST', body: form });
  if (!response.ok) throw new Error('UPLOAD_FAILED');
  const uploaded = (await response.json()) as {
    public_id: string;
    version: number;
    signature: string;
  };
  return { publicId: uploaded.public_id, version: uploaded.version, signature: uploaded.signature };
}

/** Vote in a poll. */
export async function votePoll(
  groupId: string,
  messageId: string,
  optionIndex: number,
): Promise<ChatMessage> {
  return (
    await unwrap<{ message: ChatMessage }>(
      api.post(`/groups/${groupId}/messages/${messageId}/vote`, { optionIndex }),
    )
  ).message;
}

/** Pin or unpin (leader). */
export async function pinMessage(
  groupId: string,
  messageId: string,
  pinned: boolean,
): Promise<ChatMessage> {
  return (
    await unwrap<{ message: ChatMessage }>(
      api.post(`/groups/${groupId}/messages/${messageId}/pin`, { pinned }),
    )
  ).message;
}

/** Report a message. */
export async function reportMessage(
  groupId: string,
  messageId: string,
  reason?: string,
): Promise<ChatMessage> {
  return (
    await unwrap<{ message: ChatMessage }>(
      api.post(`/groups/${groupId}/messages/${messageId}/report`, reason ? { reason } : {}),
    )
  ).message;
}
