/**
 * NativeWind registrations for components it does not style by itself.
 *
 * On Android/iOS NativeWind already understands Reanimated's Animated.View. On web it does
 * not, so every `className` on an Animated.View was silently dropped (cards lost their
 * borders and row layout). Registering it maps `className` to `style` on web.
 * Import this once, from the root layout.
 */
import { cssInterop } from 'nativewind';
import { Platform } from 'react-native';
import Animated from 'react-native-reanimated';

if (Platform.OS === 'web') {
  cssInterop(Animated.View, { className: 'style' });
}
