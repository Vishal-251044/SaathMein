/**
 * InterestsSummaryCard — Home placeholder (Day 3) showing what the user plans to buy:
 * chosen categories, brands, budget and timeline, with an Edit action.
 * Real "Groups for You" sections replace the placeholder on Days 11 and 16.
 */
import { router } from 'expo-router';
import { Pencil, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useCategories } from '@/hooks/useCatalog';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { UserInterests } from '@/types/auth';
import { enterUp } from '@/utils/animations';
import { formatBudgetShort } from '@/utils/budget';
import { categoryIcon } from '@/utils/categoryIcons';
import { localizedName } from '@/utils/localize';

const TIMELINE_KEYS = {
  this_month: 'interests.timelineThisMonth',
  '1_3_months': 'interests.timelineOneToThree',
  exploring: 'interests.timelineExploring',
} as const;

interface InterestsSummaryCardProps {
  interests: UserInterests;
}

/**
 * @param props.interests - The user's saved interests
 */
export function InterestsSummaryCard({ interests }: InterestsSummaryCardProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const { data: groups } = useCategories();

  const chosen = (groups ?? [])
    .flatMap((group) => group.children)
    .filter((category) => interests.categories.includes(category.id));
  const hasBudget = interests.budgetMinPaise != null && interests.budgetMaxPaise != null;
  const isEmpty = chosen.length === 0 && !hasBudget && !interests.timeline;

  return (
    <Animated.View
      entering={enterUp(1)}
      className="gap-4 rounded-card border border-line bg-surface p-5"
    >
      <View className="flex-row items-center justify-between gap-3">
        <AppText variant="heading" className="flex-1">
          {t('home.yourInterests')}
        </AppText>
        <Pressable
          onPress={() => router.push('/edit-interests')}
          accessibilityRole="button"
          accessibilityLabel={t('home.editInterests')}
          className="h-12 w-12 items-center justify-center rounded-button bg-bg-band"
        >
          <Pencil size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      {isEmpty ? (
        <View className="flex-row items-start gap-3">
          <Sparkles size={18} color={colors.muted} strokeWidth={2} />
          <AppText variant="body" color="muted" className="flex-1">
            {t('home.noInterests')}
          </AppText>
        </View>
      ) : (
        <>
          {chosen.length ? (
            <View className="flex-row flex-wrap gap-2">
              {chosen.map((category) => {
                const Icon = categoryIcon(category.icon);
                return (
                  <View
                    key={category.id}
                    className="flex-row items-center gap-2 rounded-full bg-bg-band px-3 py-2"
                  >
                    <Icon size={16} color={colors.muted} strokeWidth={2} />
                    <AppText variant="caption" color="ink">
                      {localizedName(category, i18n.language)}
                    </AppText>
                  </View>
                );
              })}
            </View>
          ) : null}
          {interests.brands.length ? (
            <AppText variant="caption">{interests.brands.join(' · ')}</AppText>
          ) : null}
          <View className="flex-row flex-wrap gap-x-6 gap-y-2">
            {hasBudget ? (
              <View>
                <AppText variant="label">{t('interests.budgetTitle')}</AppText>
                <AppText variant="bodyStrong" mono>
                  {`${formatBudgetShort(interests.budgetMinPaise!)} – ${formatBudgetShort(interests.budgetMaxPaise!)}`}
                </AppText>
              </View>
            ) : null}
            {interests.timeline ? (
              <View>
                <AppText variant="label">{t('interests.timelineTitle')}</AppText>
                <AppText variant="bodyStrong">{t(TIMELINE_KEYS[interests.timeline])}</AppText>
              </View>
            ) : null}
          </View>
        </>
      )}
    </Animated.View>
  );
}
