/**
 * CityAreaForm — choose city, area and pincode (ACC-2). "Use my location" fills them in
 * automatically (with permission); everything stays editable by hand.
 * Used in onboarding and in Profile → Change city.
 */
import { Check, LocateFixed, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useCities } from '@/hooks/useCatalog';
import { useThemeColors } from '@/hooks/useThemeColors';
import { detectLocation, LocationError } from '@/lib/location';
import { matchLocation } from '@/services/catalog.service';
import type { Area } from '@/types/catalog';
import { enterFade } from '@/utils/animations';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { cx } from '@/utils/genericFunctions';
import { localizedName } from '@/utils/localize';
import { Skeleton } from '@/components/animations/Skeleton';

export interface CityAreaValue {
  cityId: string;
  area: string | null;
  pincode: string | null;
}

interface CityAreaFormProps {
  initial?: { cityId: string | null; area: string | null; pincode: string | null };
  submitLabel: string;
  isSubmitting: boolean;
  errorKey?: string | null;
  onSubmit: (value: CityAreaValue) => void;
}

const PINCODE_REGEX = /^[1-9]\d{5}$/;
const MAX_VISIBLE_AREAS = 60;

/**
 * @param props.initial - Saved city/area/pincode (edit mode)
 * @param props.onSubmit - Called with the chosen city, area (English name) and pincode
 */
export function CityAreaForm({
  initial,
  submitLabel,
  isSubmitting,
  errorKey,
  onSubmit,
}: CityAreaFormProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const { data: cities, isPending, isError, error, refetch, isFetching } = useCities();

  const [cityId, setCityId] = useState<string | null>(initial?.cityId ?? null);
  const [areaName, setAreaName] = useState<string | null>(initial?.area ?? null);
  const [pincode, setPincode] = useState(initial?.pincode ?? '');
  const [search, setSearch] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationNoticeKey, setLocationNoticeKey] = useState<string | null>(null);

  // A single launch city is selected automatically
  const selectedCityId = cityId ?? (cities?.length === 1 ? cities[0].id : null);
  const city = cities?.find((item) => item.id === selectedCityId) ?? null;

  const filteredAreas = useMemo(() => {
    const term = search.trim().toLowerCase();
    const areas = city?.areas ?? [];
    if (!term) return areas;
    return areas.filter(
      (area: Area) =>
        area.name.toLowerCase().includes(term) ||
        localizedName(area, i18n.language).toLowerCase().includes(term) ||
        area.pincodes.some((pin) => pin.startsWith(term)),
    );
  }, [city, search, i18n.language]);

  /** Fill city, area and pincode from the phone's location. */
  const useMyLocation = async () => {
    setIsLocating(true);
    setLocationNoticeKey(null);
    try {
      const location = await detectLocation();
      const match = await matchLocation(location);
      if (location.pincode) setPincode(location.pincode);
      if (!match.city) {
        setLocationNoticeKey('city.notInLaunchCity');
        return;
      }
      setCityId(match.city.id);
      if (match.area) setAreaName(match.area.name);
      setLocationNoticeKey(match.area ? 'city.detected' : 'city.detectedPickArea');
    } catch (err) {
      if (err instanceof LocationError) {
        setLocationNoticeKey(
          err.code === 'PERMISSION_DENIED' ? 'city.permissionDenied' : 'city.locationUnavailable',
        );
      } else {
        setLocationNoticeKey(getErrorMessageKey(err));
      }
    } finally {
      setIsLocating(false);
    }
  };

  /** Picking an area also fills its pincode when the area has exactly one. */
  const pickArea = (area: Area) => {
    setAreaName(area.name);
    if (!PINCODE_REGEX.test(pincode) && area.pincodes.length === 1) setPincode(area.pincodes[0]);
  };

  if (isPending) {
    return (
      <View className="gap-3">
        <Skeleton className="h-12 rounded-button" />
        <Skeleton className="h-40 rounded-card" />
      </View>
    );
  }

  if (isError && !cities) {
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

  const isPincodeValid = pincode === '' || PINCODE_REGEX.test(pincode);
  const canSubmit = Boolean(selectedCityId) && Boolean(areaName) && isPincodeValid;
  const isPositiveNotice =
    locationNoticeKey === 'city.detected' || locationNoticeKey === 'city.detectedPickArea';

  return (
    <View className="gap-6">
      <Button
        label={t('city.useMyLocation')}
        icon={LocateFixed}
        variant="secondary"
        onPress={useMyLocation}
        loading={isLocating}
      />
      {locationNoticeKey ? (
        <Notice tone={isPositiveNotice ? 'info' : 'warning'} message={t(locationNoticeKey)} />
      ) : null}

      {cities && cities.length > 1 ? (
        <View className="gap-3">
          <AppText variant="heading">{t('city.cityTitle')}</AppText>
          <View className="flex-row flex-wrap gap-2">
            {cities.map((item) => (
              <Chip
                key={item.id}
                role="radio"
                label={localizedName(item, i18n.language)}
                selected={item.id === selectedCityId}
                onPress={() => {
                  setCityId(item.id);
                  setAreaName(null);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {city ? (
        <View className="gap-3">
          <AppText variant="heading">
            {t('city.areaTitle', { city: localizedName(city, i18n.language) })}
          </AppText>

          <View className="min-h-12 flex-row items-center gap-2 rounded-button border-2 border-line bg-surface px-3">
            <Search size={18} color={colors.muted} strokeWidth={2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('city.searchArea')}
              placeholderTextColor={colors.muted}
              accessibilityLabel={t('city.searchArea')}
              className="min-h-12 flex-1 text-[16px] text-ink"
            />
          </View>

          <View
            className="overflow-hidden rounded-card border border-line bg-surface"
            accessibilityRole="radiogroup"
          >
            {filteredAreas.slice(0, MAX_VISIBLE_AREAS).map((area, index) => {
              const isSelected = area.name === areaName;
              return (
                <Pressable
                  key={area.id}
                  onPress={() => pickArea(area)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={cx(
                    'min-h-12 flex-row items-center justify-between px-4 py-3',
                    index > 0 && 'border-t border-line',
                    isSelected && 'bg-primary/10',
                  )}
                >
                  <View className="flex-1">
                    <AppText variant="bodyStrong" color={isSelected ? 'primary' : 'ink'}>
                      {localizedName(area, i18n.language)}
                    </AppText>
                    {area.pincodes.length ? (
                      <AppText variant="caption" mono>
                        {area.pincodes.join(', ')}
                      </AppText>
                    ) : null}
                  </View>
                  {isSelected ? <Check size={20} color={colors.ink} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
            {filteredAreas.length === 0 ? (
              <Animated.View entering={enterFade} className="px-4 py-6">
                <AppText variant="body" color="muted" className="text-center">
                  {t('city.noAreaMatch')}
                </AppText>
              </Animated.View>
            ) : null}
          </View>
        </View>
      ) : null}

      <TextField
        label={t('city.pincode')}
        hint={t('city.pincodeHint')}
        value={pincode}
        onChangeText={(text) => setPincode(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="postal-code"
        maxLength={6}
        mono
        error={isPincodeValid ? null : t('city.pincodeInvalid')}
      />

      {errorKey ? <Notice message={t(errorKey)} /> : null}

      <Button
        label={submitLabel}
        loading={isSubmitting}
        disabled={!canSubmit}
        onPress={() =>
          selectedCityId &&
          onSubmit({ cityId: selectedCityId, area: areaName, pincode: pincode ? pincode : null })
        }
      />
    </View>
  );
}
