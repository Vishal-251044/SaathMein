/**
 * GroupStatusBadge — small pill with the group's status (open, auction live, expired...).
 * Mint is reserved for money saved, so statuses use brand, warning, danger or neutral.
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { GroupStatus } from '@/types/group';
import { cx } from '@/utils/genericFunctions';

const TONES: Record<GroupStatus, { box: string; text: 'primary' | 'ink' | 'danger' | 'muted' }> = {
  open: { box: 'bg-primary/10', text: 'primary' },
  full: { box: 'bg-primary/10', text: 'primary' },
  auction_live: { box: 'bg-warning/15', text: 'ink' },
  won: { box: 'bg-primary/10', text: 'primary' },
  purchasing: { box: 'bg-primary/10', text: 'primary' },
  runner_up: { box: 'bg-warning/15', text: 'ink' },
  completed: { box: 'bg-bg-band', text: 'muted' },
  expired: { box: 'bg-bg-band', text: 'muted' },
  no_deal: { box: 'bg-danger/10', text: 'danger' },
  cancelled: { box: 'bg-danger/10', text: 'danger' },
};

/** @param props.status - Group status */
export function GroupStatusBadge({ status }: { status: GroupStatus }) {
  const { t } = useTranslation();
  const tone = TONES[status] ?? TONES.expired;
  return (
    <View className={cx('self-start rounded-full px-2.5 py-0.5', tone.box)}>
      <AppText variant="label" color={tone.text}>
        {t(`group.status.${status}`)}
      </AppText>
    </View>
  );
}
