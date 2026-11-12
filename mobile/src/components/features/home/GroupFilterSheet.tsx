/**
 * GroupFilterSheet — bottom sheet with the browse filters (DIS-4): category, area, price
 * range, group size, time left, type and sort, as chips (48 dp targets). Works on a
 * draft and applies on "Show groups".
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useCategories, useCities } from '@/hooks/useCatalog';
import { useAuthStore } from '@/stores/auth.store';
import type { GroupFilters } from '@/types/feed';
import { localizedName } from '@/utils/localize';

/** Price bands in paise (₹). */
const PRICES = [
  { key: 'under20k', max: 2_000_000 },
  { key: '20to50k', min: 2_000_000, max: 5_000_000 },
  { key: '50kto1l', min: 5_000_000, max: 10_000_000 },
  { key: 'over1l', min: 10_000_000 },
] as const;
const SIZES = [
  { key: 'small', max: 10 },
  { key: 'medium', min: 11, max: 25 },
  { key: 'large', min: 26 },
] as const;
const TIME_LEFT = [24, 72, 168] as const;
const SORTS = ['ending_soon', 'filling', 'newest'] as const;

interface Props {
  visible: boolean;
  value: GroupFilters;
  onClose: () => void;
  onApply: (filters: GroupFilters) => void;
}

/** Section heading + wrapping chips. */
function ChipRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <AppText variant="label">{title}</AppText>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

/** @returns Filter sheet */
export function GroupFilterSheet({ visible, value, onClose, onApply }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const { data: categories } = useCategories();
  const { data: cities } = useCities();
  const [draft, setDraft] = useState<GroupFilters>(value);
  const [lastValue, setLastValue] = useState(value);
  // Reset the draft when the sheet opens with new filters (derived state, no effect)
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const city = cities?.find((item) => item.id === user?.cityId);
  const leafCategories = (categories ?? []).flatMap((parent) => parent.children ?? []);
  const toggle = (patch: GroupFilters, active: boolean, clearKeys: (keyof GroupFilters)[]) =>
    setDraft((prev) => {
      const next = { ...prev };
      clearKeys.forEach((key) => delete next[key]);
      return active ? next : { ...next, ...patch };
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      />
      <View
        className="max-h-[85%] rounded-t-card bg-surface pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        accessibilityViewIsModal
      >
        <View className="h-1.5 w-12 self-center rounded-full bg-line" />
        <AppText variant="heading" className="px-5 pt-3">
          {t('browse.filters')}
        </AppText>
        <ScrollView contentContainerStyle={{ gap: 20, padding: 20 }}>
          <ChipRow title={t('browse.sortTitle')}>
            {SORTS.map((sort) => (
              <Chip
                key={sort}
                role="radio"
                label={t(`browse.sort.${sort}`)}
                selected={(draft.sort ?? 'ending_soon') === sort}
                onPress={() => setDraft((prev) => ({ ...prev, sort }))}
              />
            ))}
          </ChipRow>
          <ChipRow title={t('browse.typeTitle')}>
            {(['buyer_led', 'seller_led'] as const).map((type) => (
              <Chip
                key={type}
                role="radio"
                label={t(`browse.type.${type}`)}
                selected={draft.type === type}
                onPress={() => toggle({ type }, draft.type === type, ['type'])}
              />
            ))}
          </ChipRow>
          {leafCategories.length ? (
            <ChipRow title={t('browse.categoryTitle')}>
              {leafCategories.map((category) => (
                <Chip
                  key={category.id}
                  role="radio"
                  label={localizedName(category, i18n.language)}
                  selected={draft.categoryId === category.id}
                  onPress={() =>
                    toggle({ categoryId: category.id }, draft.categoryId === category.id, [
                      'categoryId',
                    ])
                  }
                />
              ))}
            </ChipRow>
          ) : null}
          {city?.areas.length ? (
            <ChipRow title={t('browse.areaTitle')}>
              {city.areas.map((area) => (
                <Chip
                  key={area.id}
                  role="radio"
                  label={localizedName(area, i18n.language)}
                  selected={draft.area === area.name}
                  onPress={() => toggle({ area: area.name }, draft.area === area.name, ['area'])}
                />
              ))}
            </ChipRow>
          ) : null}
          <ChipRow title={t('browse.priceTitle')}>
            {PRICES.map((band) => {
              const min = 'min' in band ? band.min : undefined;
              const max = 'max' in band ? band.max : undefined;
              const active = draft.minPricePaise === min && draft.maxPricePaise === max;
              return (
                <Chip
                  key={band.key}
                  role="radio"
                  label={t(`browse.price.${band.key}`)}
                  selected={active}
                  onPress={() =>
                    toggle({ minPricePaise: min, maxPricePaise: max }, active, [
                      'minPricePaise',
                      'maxPricePaise',
                    ])
                  }
                />
              );
            })}
          </ChipRow>
          <ChipRow title={t('browse.sizeTitle')}>
            {SIZES.map((band) => {
              const min = 'min' in band ? band.min : undefined;
              const max = 'max' in band ? band.max : undefined;
              const active = draft.minSize === min && draft.maxSize === max;
              return (
                <Chip
                  key={band.key}
                  role="radio"
                  label={t(`browse.size.${band.key}`)}
                  selected={active}
                  onPress={() =>
                    toggle({ minSize: min, maxSize: max }, active, ['minSize', 'maxSize'])
                  }
                />
              );
            })}
          </ChipRow>
          <ChipRow title={t('browse.timeTitle')}>
            {TIME_LEFT.map((hours) => (
              <Chip
                key={hours}
                role="radio"
                label={t(`browse.time.h${hours}`)}
                selected={draft.endsWithinHours === hours}
                onPress={() =>
                  toggle({ endsWithinHours: hours }, draft.endsWithinHours === hours, [
                    'endsWithinHours',
                  ])
                }
              />
            ))}
          </ChipRow>
        </ScrollView>
        <View className="flex-row gap-3 px-5">
          <View className="flex-1">
            <Button label={t('browse.clear')} variant="secondary" onPress={() => setDraft({})} />
          </View>
          <View className="flex-1">
            <Button label={t('browse.apply')} onPress={() => onApply(draft)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
