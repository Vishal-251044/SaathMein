/**
 * Saathi tab — the AI shopping assistant. Day 1: introduction in Saathi violet.
 * Chat with tool calling arrives on Day 15.
 */
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/features/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AppText } from '@/components/ui/AppText';

/**
 * @returns Saathi screen
 */
export default function SaathiScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader
        title={t('saathi.title')}
        trailing={
          <View className="rounded-full bg-ai-soft px-3 py-1.5">
            <AppText variant="label" color="ai">
              {t('saathi.badge')}
            </AppText>
          </View>
        }
      />
      <EmptyState
        icon={Sparkles}
        tone="ai"
        title={t('saathi.emptyTitle')}
        body={t('saathi.emptyBody')}
      />
    </Screen>
  );
}
