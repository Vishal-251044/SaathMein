/**
 * ServerStatusCard — development helper on Profile that shows whether the app can
 * reach the backend (/api/health). Shown only in development builds.
 */
import { RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useApiHealth } from '@/hooks/useApiHealth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { API_URL } from '@/utils/constants';
import { cx } from '@/utils/genericFunctions';

/**
 * @returns Card with the backend connection state and a refresh button
 */
export function ServerStatusCard() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data, isPending, isError, refetch, isFetching } = useApiHealth();

  let label = t('profile.checking');
  let dotClass = 'bg-muted';
  if (isError) {
    label = t('profile.serverDown');
    dotClass = 'bg-danger';
  } else if (data) {
    const isOk = data.status === 'ok';
    label = isOk ? t('profile.serverOk') : t('profile.serverDegraded');
    dotClass = isOk ? 'bg-savings' : 'bg-warning';
  }

  return (
    <View className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4">
      <View className={cx('h-2.5 w-2.5 rounded-full', dotClass)} />
      <View className="flex-1">
        <AppText variant="label">{t('profile.serverStatus')}</AppText>
        <AppText variant="bodyStrong" className="mt-0.5">
          {label}
        </AppText>
        <AppText variant="caption" mono className="mt-0.5" numberOfLines={1}>
          {API_URL}
        </AppText>
      </View>
      <Pressable
        onPress={() => refetch()}
        disabled={isPending || isFetching}
        accessibilityRole="button"
        accessibilityLabel={t('common.retry')}
        className="h-12 w-12 items-center justify-center rounded-button bg-bg-band"
      >
        <RefreshCw size={18} color={colors.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
