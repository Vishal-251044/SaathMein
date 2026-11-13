/**
 * OfflineBanner — a floating card above the tab bar on every screen while the API cannot
 * be reached (floating, so no screen layout or safe-area padding changes).
 * Screens keep showing their saved data; the banner says so, and offers "Try again".
 * When the connection returns it says "Back online" briefly, then hides.
 */
import { CloudOff, Wifi } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useOnline } from '@/hooks/useOnline';
import { useThemeColors } from '@/hooks/useThemeColors';
import { checkConnectionNow } from '@/lib/connectivity';
import { DURATION } from '@/utils/animations';

const BACK_ONLINE_MS = 2_500;
/** Space kept free for the bottom tab bar. */
const TAB_BAR_SPACE = 76;

/**
 * @returns The banner, or nothing while online
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const wasOffline = useRef(false);
  const [showBack, setShowBack] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return undefined;
    }
    if (!wasOffline.current) return undefined;
    wasOffline.current = false;
    // Briefly confirm the connection is back (state change from an external store)
    const show = setTimeout(() => setShowBack(true), 0);
    const hide = setTimeout(() => setShowBack(false), BACK_ONLINE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [online]);

  const retry = async () => {
    setChecking(true);
    await checkConnectionNow();
    setChecking(false);
  };

  if (online && !showBack) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(DURATION.base).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(DURATION.fast).reduceMotion(ReduceMotion.System)}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + TAB_BAR_SPACE,
        elevation: 6,
      }}
      className="rounded-card border border-line bg-surface shadow-lg"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View className="min-h-12 flex-row items-center gap-3 px-4 py-2">
        {online ? (
          <Wifi size={18} color={colors.ink} strokeWidth={2} />
        ) : (
          <CloudOff size={18} color={colors.warning} strokeWidth={2} />
        )}
        <View className="flex-1">
          <AppText variant="bodyStrong">
            {online ? t('offline.backOnline') : t('offline.title')}
          </AppText>
          {!online ? (
            <AppText variant="caption" color="muted">
              {t('offline.body')}
            </AppText>
          ) : null}
        </View>
        {!online ? (
          <Pressable
            onPress={retry}
            disabled={checking}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
            className="min-h-12 min-w-12 items-center justify-center rounded-button border border-line px-3"
          >
            {checking ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <AppText variant="bodyStrong">{t('common.retry')}</AppText>
            )}
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
