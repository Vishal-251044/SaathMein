/**
 * Trust service — reports (/reports), disputes (/disputes) with private evidence uploads,
 * and dealer profiles (/sellers/:id, /sellers/:id/reviews). TRU-2 to TRU-5.
 */
import type {
  DealerProfile,
  DealerReviewPage,
  Dispute,
  DisputePage,
  OpenDisputeInput,
  ReportReason,
  ReportTarget,
} from '@/types/trust';

import { api, type ApiEnvelope, unwrap } from './api';

/** Report something; 409 ALREADY_REPORTED when I reported it before. */
export async function createReport(input: {
  targetType: ReportTarget;
  targetId: string;
  groupId?: string;
  reason: ReportReason;
  details?: string;
}): Promise<{ id: string }> {
  return (await unwrap<{ report: { id: string } }>(api.post('/reports', input))).report;
}

/**
 * Upload one evidence photo privately (signed by the API).
 * @param image - Local JPEG from the picker
 */
export async function uploadDisputeEvidence(image: { uri: string; mimeType: string }) {
  const { uploadUrl, fields } = await unwrap<{
    uploadUrl: string;
    fields: Record<string, string | number>;
  }>(api.post('/disputes/evidence-upload-params'));
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  form.append('file', {
    uri: image.uri,
    type: image.mimeType,
    name: 'evidence.jpg',
  } as unknown as Blob);
  const response = await fetch(uploadUrl, { method: 'POST', body: form });
  if (!response.ok) throw new Error('UPLOAD_FAILED');
  const uploaded = (await response.json()) as {
    public_id: string;
    version: number;
    signature: string;
  };
  return {
    publicId: uploaded.public_id,
    version: uploaded.version,
    signature: uploaded.signature,
    format: 'jpg' as const,
  };
}

/** Open a dispute about my purchase. */
export async function openDispute(input: OpenDisputeInput): Promise<Dispute> {
  return (await unwrap<{ dispute: Dispute }>(api.post('/disputes', input))).dispute;
}

/** My disputes, newest first. */
export async function getMyDisputes(page = 1): Promise<DisputePage> {
  const response = await api.get<ApiEnvelope<{ disputes: Dispute[] }>>('/disputes', {
    params: { page, limit: 20 },
  });
  return { disputes: response.data.data.disputes, meta: response.data.meta as DisputePage['meta'] };
}

/** One of my disputes with its timeline. */
export async function getMyDispute(disputeId: string): Promise<Dispute> {
  return (await unwrap<{ dispute: Dispute }>(api.get(`/disputes/${disputeId}`))).dispute;
}

/** A verified dealer's public profile. */
export async function getDealer(sellerId: string): Promise<DealerProfile> {
  return (await unwrap<{ seller: DealerProfile }>(api.get(`/sellers/${sellerId}`))).seller;
}

/** Published reviews of a dealer. */
export async function getDealerReviews(sellerId: string, page: number): Promise<DealerReviewPage> {
  const response = await api.get<ApiEnvelope<{ reviews: DealerReviewPage['reviews'] }>>(
    `/sellers/${sellerId}/reviews`,
    { params: { page, limit: 20 } },
  );
  return {
    reviews: response.data.data.reviews,
    meta: response.data.meta as DealerReviewPage['meta'],
  };
}
