/**
 * InterestsForm — interest onboarding (ACC-3): categories → brands → budget → timeline.
 * Used for first-time onboarding (with Skip) and for editing interests later.
 * Shows skeletons while categories load and a retry on error.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { BudgetRangeSlider } from '@/components/features/BudgetRangeSlider';
import { CategoryPicker } from '@/components/features/CategoryPicker';
import { TimelinePicker } from '@/components/features/TimelinePicker';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { useCategories } from '@/hooks/useCatalog';
import type { BuyingTimeline, UserInterests } from '@/types/auth';
import { enterUp } from '@/utils/animations';
import { BUDGET_MAX_PAISE, BUDGET_MIN_PAISE, formatBudgetShort, snapBudget } from '@/utils/budget';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { Skeleton } from '@/components/animations/Skeleton';

export interface InterestsValue {
  categories: string[];
  brands: string[];
  /** Undefined when the user never set a budget. */
  budgetMinPaise?: number;
  budgetMaxPaise?: number;
  timeline: BuyingTimeline | null;
}

interface InterestsFormProps {
  initial?: UserInterests | null;
  submitLabel: string;
  isSubmitting: boolean;
  errorKey?: string | null;
  onSubmit: (value: InterestsValue) => void;
  /** Shown only in onboarding. */
  onSkip?: () => void;
}

/** Default budget range before the user moves the slider: ₹50K–₹2L. */
const DEFAULT_MIN = snapBudget(50_000 * 100);
const DEFAULT_MAX = snapBudget(2_00_000 * 100);

/**
 * Toggle a value in a list.
 * @param list - Current values
 * @param value - Value to add or remove
 */
const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/** Section heading with a step number. */
function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={enterUp(step)} className="gap-3">
      <View className="flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-bg-band">
          <AppText variant="label" mono color="ink">
            {String(step)}
          </AppText>
        </View>
        <AppText variant="heading">{title}</AppText>
      </View>
      {children}
    </Animated.View>
  );
}

/**
 * @param props.initial - Saved interests (edit mode)
 * @param props.onSubmit - Called with the chosen values
 * @param props.onSkip - Skip handler (onboarding only)
 */
export function InterestsForm({
  initial,
  submitLabel,
  isSubmitting,
  errorKey,
  onSubmit,
  onSkip,
}: InterestsFormProps) {
  const { t } = useTranslation();
  const { data: groups, isPending, isError, error, refetch, isFetching } = useCategories();

  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);
  const [brands, setBrands] = useState<string[]>(initial?.brands ?? []);
  const [budget, setBudget] = useState({
    minPaise: initial?.budgetMinPaise ?? DEFAULT_MIN,
    maxPaise: initial?.budgetMaxPaise ?? DEFAULT_MAX,
  });
  // Only save a budget the user actually chose (not the slider's starting position)
  const [hasBudget, setHasBudget] = useState(initial?.budgetMinPaise != null);
  const [timeline, setTimeline] = useState<BuyingTimeline | null>(initial?.timeline ?? null);

  // Brands offered = featured brands of the chosen categories (deduplicated)
  const brandOptions = useMemo(() => {
    const chosen = (groups ?? [])
      .flatMap((group) => group.children)
      .filter((c) => categories.includes(c.id));
    return [...new Set(chosen.flatMap((category) => category.featuredBrands))];
  }, [groups, categories]);

  const handleToggleCategory = (categoryId: string) => {
    const next = toggle(categories, categoryId);
    setCategories(next);
    // Drop brands that no longer belong to any chosen category
    const allowed = new Set(
      (groups ?? [])
        .flatMap((group) => group.children)
        .filter((c) => next.includes(c.id))
        .flatMap((c) => c.featuredBrands),
    );
    setBrands((current) => current.filter((brand) => allowed.has(brand)));
  };

  if (isPending) {
    return (
      <View className="gap-3" accessibilityLabel={t('common.loading')}>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-12 w-3/4 rounded-full" />
        ))}
      </View>
    );
  }

  if (isError && !groups) {
    return (
      <View className="gap-4">
        <Notice message={t(getErrorMessageKey(error))} />
        <Button
          label={t('common.retry')}
          variant="secondary"
          onPress={() => refetch()}
          loading={isFetching}
        />
      </View>
    );
  }

  return (
    <View className="gap-8">
      <Section step={1} title={t('interests.categoriesTitle')}>
        <CategoryPicker groups={groups} selectedIds={categories} onToggle={handleToggleCategory} />
      </Section>

      {brandOptions.length > 0 ? (
        <Section step={2} title={t('interests.brandsTitle')}>
          <View className="flex-row flex-wrap gap-2">
            {brandOptions.map((brandName) => (
              <Chip
                key={brandName}
                label={brandName}
                selected={brands.includes(brandName)}
                onPress={() => setBrands((current) => toggle(current, brandName))}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section step={brandOptions.length > 0 ? 3 : 2} title={t('interests.budgetTitle')}>
        <BudgetRangeSlider
          label={t('interests.budgetTitle')}
          minLabel={t('interests.budgetMin')}
          maxLabel={t('interests.budgetMax')}
          minPaise={budget.minPaise}
          maxPaise={budget.maxPaise}
          onChange={(range) => {
            setBudget(range);
            setHasBudget(true);
          }}
        />
        <AppText variant="caption">
          {t('interests.budgetHint', {
            min: formatBudgetShort(BUDGET_MIN_PAISE),
            max: formatBudgetShort(BUDGET_MAX_PAISE),
          })}
        </AppText>
      </Section>

      <Section step={brandOptions.length > 0 ? 4 : 3} title={t('interests.timelineTitle')}>
        <TimelinePicker value={timeline} onChange={setTimeline} />
      </Section>

      {errorKey ? <Notice message={t(errorKey)} /> : null}

      <View className="gap-3">
        <Button
          label={submitLabel}
          loading={isSubmitting}
          onPress={() =>
            onSubmit({
              categories,
              brands,
              ...(hasBudget
                ? {
                    budgetMinPaise: Math.max(BUDGET_MIN_PAISE, budget.minPaise),
                    budgetMaxPaise: Math.min(BUDGET_MAX_PAISE, budget.maxPaise),
                  }
                : {}),
              timeline,
            })
          }
        />
        {onSkip ? (
          <Button
            label={t('interests.skip')}
            variant="ghost"
            onPress={onSkip}
            disabled={isSubmitting}
          />
        ) : null}
      </View>
    </View>
  );
}
