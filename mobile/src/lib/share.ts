/**
 * Sharing (LIV-4): WhatsApp first (most Indian buyers share there), with a pre-filled
 * invite text and the group link; falls back to the system share sheet when WhatsApp is
 * not installed.
 */
import { Linking, Share } from 'react-native';

/**
 * Open WhatsApp with the message, or the share sheet.
 * @param message - Text including the link
 * @returns How it was shared
 */
export async function shareToWhatsApp(message: string): Promise<'whatsapp' | 'sheet' | 'none'> {
  const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
  try {
    // canOpenURL needs a <queries> entry on Android 11+, so just try to open it
    await Linking.openURL(url);
    return 'whatsapp';
  } catch {
    // WhatsApp not installed: fall through to the share sheet
  }
  try {
    await Share.share({ message });
    return 'sheet';
  } catch {
    return 'none';
  }
}
