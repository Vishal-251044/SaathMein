/**
 * Avatar — round profile photo with an initial (or icon) fallback.
 */
import { Image } from 'expo-image';
import { CircleUserRound } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
}

/**
 * @param props.url - Photo URL (Cloudinary)
 * @param props.name - Used for the initial when there is no photo
 * @param props.size - Diameter in dp (default 56)
 */
export function Avatar({ url, name, size = 56 }: AvatarProps) {
  const { colors } = useThemeColors();
  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-bg-band"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : initial ? (
        <AppText variant="title">{initial}</AppText>
      ) : (
        <CircleUserRound size={size * 0.55} color={colors.muted} strokeWidth={1.8} />
      )}
    </View>
  );
}
