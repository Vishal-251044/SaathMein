/**
 * Pick photos from the gallery (profile photo: square 512 px; chat photo: up to 1280 px),
 * resized to JPEG on the phone so the
 * upload is small on mobile data (PRD §14 low-data images).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  uri: string;
  mimeType: string;
}

const AVATAR_SIZE = 512;

/**
 * Open the gallery and return a resized photo.
 * @returns The photo, or null when the user cancels
 * @throws Error PHOTO_PERMISSION_DENIED when gallery access is refused
 */
export async function pickAvatarImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('PHOTO_PERMISSION_DENIED');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  const rendered = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: AVATAR_SIZE })
    .renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: saved.uri, mimeType: 'image/jpeg' };
}

const CHAT_IMAGE_WIDTH = 1280;

/**
 * Pick a photo for group chat: no crop, at most 1280 px wide, JPEG (low data).
 * @returns The photo, or null when the user cancels
 * @throws Error PHOTO_PERMISSION_DENIED when gallery access is refused
 */
export async function pickChatImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('PHOTO_PERMISSION_DENIED');

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;

  const width = Math.min(asset.width || CHAT_IMAGE_WIDTH, CHAT_IMAGE_WIDTH);
  const rendered = await ImageManipulator.manipulate(asset.uri).resize({ width }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: saved.uri, mimeType: 'image/jpeg' };
}

const INVOICE_IMAGE_WIDTH = 1600;

/**
 * Photo of the shop invoice (PUR-2): camera or gallery, at most 1600 px wide (still
 * readable for the Day 19 invoice check), JPEG.
 * @param source - 'camera' or 'library'
 * @returns The photo, or null when the user cancels
 * @throws Error PHOTO_PERMISSION_DENIED when access is refused
 */
export async function pickInvoiceImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('PHOTO_PERMISSION_DENIED');

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;

  const width = Math.min(asset.width || INVOICE_IMAGE_WIDTH, INVOICE_IMAGE_WIDTH);
  const rendered = await ImageManipulator.manipulate(asset.uri).resize({ width }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, mimeType: 'image/jpeg' };
}
