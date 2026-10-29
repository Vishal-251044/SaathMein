/**
 * Low-data image URLs (PRD §14): ask Cloudinary for the size actually shown, in the best
 * format for the phone (WebP/AVIF) and automatic quality. Other hosts are returned as-is.
 */
import { PixelRatio } from 'react-native';

const CLOUDINARY_UPLOAD = '/image/upload/';

/**
 * @param url - Image URL from the API
 * @param widthDp - Width the image is displayed at, in dp
 * @returns URL with a width transformation (Cloudinary) or the original URL
 */
export function sizedImageUrl(url: string | null | undefined, widthDp: number): string | null {
  if (!url) return null;
  if (!url.includes('res.cloudinary.com') || !url.includes(CLOUDINARY_UPLOAD)) return url;
  const widthPx = Math.min(1600, PixelRatio.getPixelSizeForLayoutSize(widthDp));
  return url.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}c_limit,w_${widthPx},f_auto,q_auto/`);
}
