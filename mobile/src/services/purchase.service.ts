/**
 * Purchase service — invoice upload (PUR-2), reviews (TRU-2) and my deal codes
 * (/purchases, /reviews, /users/me/deal-codes). Invoice photos go straight to Cloudinary
 * as PRIVATE files with server-signed params.
 */
import type { GroupPurchase, MyDealCode } from '@/types/group';

import { api, unwrap } from './api';

/** My open and recently completed deal codes. */
export async function getMyDealCodes(): Promise<MyDealCode[]> {
  return (await unwrap<{ purchases: MyDealCode[] }>(api.get('/users/me/deal-codes'))).purchases;
}

/**
 * Upload the invoice photo and attach it to the purchase. It completes in 48 h unless the
 * dealer objects.
 * @param purchaseId - My purchase
 * @param image - Local JPEG from the picker
 * @returns The updated purchase
 */
export async function uploadInvoice(
  purchaseId: string,
  image: { uri: string; mimeType: string },
): Promise<GroupPurchase> {
  const { uploadUrl, fields } = await unwrap<{
    uploadUrl: string;
    fields: Record<string, string | number>;
  }>(api.post(`/purchases/${purchaseId}/invoice/upload-params`));
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  // React Native FormData file part
  form.append('file', {
    uri: image.uri,
    type: image.mimeType,
    name: 'invoice.jpg',
  } as unknown as Blob);
  const response = await fetch(uploadUrl, { method: 'POST', body: form });
  if (!response.ok) throw new Error('UPLOAD_FAILED');
  const uploaded = (await response.json()) as {
    public_id: string;
    version: number;
    signature: string;
    format?: string;
  };
  return (
    await unwrap<{ purchase: GroupPurchase }>(
      api.post(`/purchases/${purchaseId}/invoice`, {
        publicId: uploaded.public_id,
        version: uploaded.version,
        signature: uploaded.signature,
        format: uploaded.format === 'jpeg' ? 'jpeg' : 'jpg',
      }),
    )
  ).purchase;
}

/** Rate the dealer after a completed purchase (1–5 stars, optional text). */
export async function createReview(input: {
  purchaseId: string;
  rating: number;
  text?: string;
}): Promise<{ id: string; rating: number }> {
  return (await unwrap<{ review: { id: string; rating: number } }>(api.post('/reviews', input)))
    .review;
}
