/**
 * Pick a profile photo from the gallery, square-cropped and resized to 512 px JPEG so the
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
