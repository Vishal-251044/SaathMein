/**
 * User service — the logged-in user's own profile: /api/users/me (ACC-2, ACC-3, ACC-5)
 * and the signed avatar upload to Cloudinary.
 */
import type { AppUser, BuyingTimeline } from '@/types/auth';

import { api, ApiClientError, unwrap } from './api';

export interface ProfileChanges {
  name?: string;
  language?: 'en' | 'hi' | 'mr';
  cityId?: string;
  area?: string | null;
  pincode?: string | null;
}

export interface InterestsInput {
  categories: string[];
  brands: string[];
  budgetMinPaise?: number;
  budgetMaxPaise?: number;
  timeline?: BuyingTimeline;
}

/**
 * @param changes - Profile fields to change
 * @returns Updated user
 */
export async function updateProfile(changes: ProfileChanges): Promise<AppUser> {
  const data = await unwrap<{ user: AppUser }>(api.patch('/users/me', changes));
  return data.user;
}

/**
 * Save onboarding interests. Empty lists = skip.
 * @param interests - Categories, brands, budget, timeline
 * @returns Updated user (onboarding complete)
 */
export async function saveInterests(interests: InterestsInput): Promise<AppUser> {
  const data = await unwrap<{ user: AppUser }>(api.post('/users/me/interests', interests));
  return data.user;
}

/** Permanently delete the account (ACC-5). */
export async function deleteAccount(): Promise<void> {
  await api.delete('/users/me');
}

interface UploadParams {
  uploadUrl: string;
  fields: Record<string, string | number | boolean>;
}

interface CloudinaryUploadResponse {
  public_id: string;
  version: number;
  signature: string;
}

/**
 * Upload a new profile photo: get signed params from the API, upload straight to
 * Cloudinary, then let the API verify and attach it.
 * @param file - Local image (already resized), e.g. from expo-image-manipulator
 * @returns Updated user with the new avatar
 * @throws ApiClientError (UPLOAD_FAILED when Cloudinary rejects the file)
 */
export async function uploadAvatar(file: { uri: string; mimeType: string }): Promise<AppUser> {
  const { uploadUrl, fields } = await unwrap<UploadParams>(
    api.post('/users/me/avatar/upload-params'),
  );

  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  // React Native's FormData accepts { uri, name, type } for files
  form.append('file', {
    uri: file.uri,
    name: 'avatar.jpg',
    type: file.mimeType,
  } as unknown as Blob);

  const response = await fetch(uploadUrl, { method: 'POST', body: form });
  if (!response.ok) {
    throw new ApiClientError('Photo upload failed', {
      status: response.status,
      code: 'UPLOAD_FAILED',
    });
  }
  const uploaded = (await response.json()) as CloudinaryUploadResponse;

  const data = await unwrap<{ user: AppUser }>(
    api.put('/users/me/avatar', {
      publicId: uploaded.public_id,
      version: uploaded.version,
      signature: uploaded.signature,
    }),
  );
  return data.user;
}

/** @returns Updated user without a photo */
export async function removeAvatar(): Promise<AppUser> {
  const data = await unwrap<{ user: AppUser }>(api.delete('/users/me/avatar'));
  return data.user;
}
