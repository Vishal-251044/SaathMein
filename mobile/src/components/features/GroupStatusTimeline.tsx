/**
 * GroupStatusTimeline — where the group is in its life: open → full → dealers bid →
 * winner → buying → done. Failure endings (expired, no deal, cancelled) replace the rest.
 */
import { Check, Circle, XCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { brand } from '@/theme/tokens';
import type { GroupStatus, GroupStatusEntry } from '@/types/group';

const STEPS: GroupStatus[] = ['open', 'full', 'auction_live', 'won', 'purchasing', 'completed'];
const FAILED: GroupStatus[] = ['expired', 'no_deal', 'cancelled'];

interface GroupStatusTimelineProps {
  status: GroupStatus;
  history: GroupStatusEntry[];
}

/**
 * @param props.status - Current status
 * @param props.history - Status changes from the API (for dates)
 */
export function GroupStatusTimeline({ status, history }: GroupStatusTimelineProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const failed = FAILED.includes(status);
  // runner_up is shown on the "buying" step
  const current = status === 'runner_up' ? 'purchasing' : status;
  const reachedIndex = failed
    ? Math.max(0, ...history.map((entry) => STEPS.indexOf(entry.from ?? 'open')))
    : STEPS.indexOf(current);
  const steps = failed ? [...STEPS.slice(0, reachedIndex + 1), status] : STEPS;
  const dateOf = (step: GroupStatus) => {
    const entry = [...history].reverse().find((item) => item.to === step);
    return entry
      ? new Date(entry.at).toLocaleDateString(
          i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`,
          {
            day: 'numeric',
            month: 'short',
          },
        )
      : null;
  };

  return (
    <View className="gap-0">
      {steps.map((step, index) => {
        const isFailure = FAILED.includes(step);
        const done = isFailure || index < reachedIndex || (!failed && index === reachedIndex);
        const isCurrent = step === current || (failed && isFailure);
        const Icon = isFailure ? XCircle : done && !isCurrent ? Check : Circle;
        const color = isFailure ? colors.danger : done ? brand.primary : colors.muted;
        const date = done ? dateOf(step) : null;
        return (
          <View key={step} className="flex-row gap-3">
            <View className="items-center">
              <Icon size={18} color={color} strokeWidth={2.2} />
              {index < steps.length - 1 ? (
                <View
                  className={`w-0.5 flex-1 ${done && !isCurrent ? 'bg-primary' : 'bg-line'}`}
                  style={{ minHeight: 18 }}
                />
              ) : null}
            </View>
            <View className="flex-1 flex-row justify-between gap-2 pb-4">
              <AppText
                variant={isCurrent ? 'bodyStrong' : 'body'}
                color={isFailure ? 'danger' : done ? 'ink' : 'muted'}
                className="flex-1"
              >
                {t(`group.timeline.${step}`)}
              </AppText>
              {date ? <AppText variant="caption">{date}</AppText> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
