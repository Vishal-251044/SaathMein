/**
 * DisputeStatusPill — dispute status for buyers (waiting for the dealer, Support reviewing,
 * decided). Uses warning / neutral colours only (mint is reserved for money saved).
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { DisputeStatus } from '@/types/trust';

const TONE: Record<DisputeStatus, string> = {
  awaiting_seller: 'bg-warning/15',
  seller_responded: 'bg-bg-band',
  seller_missed: 'bg-bg-band',
  resolved: 'bg-bg-band',
};

/** @param props.status - Dispute status */
export function DisputeStatusPill({ status }: { status: DisputeStatus }) {
  const { t } = useTranslation();
  return (
    <View className={`self-start rounded-full px-3 py-1 ${TONE[status]}`}>
      <AppText variant="label" color="ink">
        {t(`dispute.status.${status}`)}
      </AppText>
    </View>
  );
}
