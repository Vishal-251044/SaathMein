/**
 * TimelinePicker — when the user plans to buy (ACC-3): this month, 1–3 months, exploring.
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import type { BuyingTimeline } from '@/types/auth';

const OPTIONS: { value: BuyingTimeline; key: string }[] = [
  { value: 'this_month', key: 'interests.timelineThisMonth' },
  { value: '1_3_months', key: 'interests.timelineOneToThree' },
  { value: 'exploring', key: 'interests.timelineExploring' },
];

interface TimelinePickerProps {
  value: BuyingTimeline | null;
  onChange: (value: BuyingTimeline | null) => void;
}

/**
 * @param props.value - Selected timeline (tap again to clear)
 * @param props.onChange - Called with the new value
 */
export function TimelinePicker({ value, onChange }: TimelinePickerProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {OPTIONS.map((option) => (
        <Chip
          key={option.value}
          role="radio"
          label={t(option.key)}
          selected={value === option.value}
          onPress={() => onChange(value === option.value ? null : option.value)}
        />
      ))}
    </View>
  );
}
