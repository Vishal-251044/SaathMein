/**
 * Start a group (GRP-1, GRP-2): first offers similar open groups ("join this one
 * instead?") so demand is not split, then variant, group size, deadline, public or
 * community, note — then a review step. Sizes and deadline limits come from the
 * category rules; the token amount is set by the server.
 * After creating, the leader goes straight to paying the token to take their own seat.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Lock, Minus, Plus, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GroupCard } from '@/components/features/GroupCard';
import { StackScreen } from '@/components/layout/StackScreen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useCategories } from '@/hooks/useCatalog';
import { useCreateGroup, useSimilarGroups } from '@/hooks/useGroups';
import { useProduct } from '@/hooks/useProducts';
import { useThemeColors } from '@/hooks/useThemeColors';
import { brand } from '@/theme/tokens';
import type { GroupVisibility } from '@/types/group';
import { enterUp } from '@/utils/animations';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';
import { QueryErrorState } from '@/components/features/QueryErrorState';
import { Skeleton } from '@/components/animations/Skeleton';

type Step = 'similar' | 'details' | 'review';
const DEADLINE_OPTIONS = [3, 7, 10, 14, 21, 30];
const DEFAULT_DEADLINE = 7;

/** Plus / minus stepper with 48 dp buttons. */
function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const button = (delta: number, Icon: typeof Plus, a11y: string) => {
    const disabled = value + delta < min || value + delta > max;
    return (
      <Pressable
        onPress={() => onChange(value + delta)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ disabled }}
        className={`h-12 w-12 items-center justify-center rounded-button border border-line ${disabled ? 'opacity-40' : ''}`}
      >
        <Icon size={20} color={colors.ink} strokeWidth={2} />
      </Pressable>
    );
  };
  return (
    <View className="flex-row items-center gap-4" accessibilityLabel={label}>
      {button(-1, Minus, t('createGroup.fewer'))}
      <AppText variant="title" mono className="min-w-12 text-center">
        {value}
      </AppText>
      {button(1, Plus, t('createGroup.more'))}
    </View>
  );
}

/**
 * @returns Create group screen
 */
export default function CreateGroupScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ productId: string; variantKey?: string }>();
  const {
    data: product,
    error: productError,
    refetch: refetchProduct,
  } = useProduct(params.productId);
  const { data: groups } = useCategories();
  const create = useCreateGroup();

  const [variantKey, setVariantKey] = useState<string | null>(params.variantKey || null);
  const similar = useSimilarGroups(params.productId, variantKey);
  const [skipSimilar, setSkipSimilar] = useState(false);
  const [step, setStep] = useState<Exclude<Step, 'similar'>>('details');
  const [size, setSize] = useState<number | null>(null);
  const [deadlineDays, setDeadlineDays] = useState(DEFAULT_DEADLINE);
  const [visibility, setVisibility] = useState<GroupVisibility>('public');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [note, setNote] = useState('');

  const category = (groups ?? [])
    .flatMap((group) => group.children)
    .find((item) => item.id === product?.categoryId);
  const minSize = category?.rules.minSize ?? 5;
  const maxSize = category?.rules.maxSize ?? 25;
  const deadlineRange = category?.rules.deadlineDays ?? { min: 3, max: 30 };
  const targetSize = Math.min(maxSize, Math.max(minSize, size ?? minSize));
  const deadlineOptions = DEADLINE_OPTIONS.filter(
    (option) => option >= deadlineRange.min && option <= deadlineRange.max,
  );
  const days = deadlineOptions.includes(deadlineDays)
    ? deadlineDays
    : (deadlineOptions[0] ?? deadlineRange.min);

  const showSimilar = !skipSimilar && (similar.data?.length ?? 0) > 0;
  const currentStep: Step = showSimilar ? 'similar' : step;

  /** Create and open the new group page. */
  const submit = () => {
    if (!product) return;
    create.mutate(
      {
        productId: product.id,
        variantKey,
        targetSize,
        deadlineDays: days,
        visibility,
        ...(visibility === 'community' ? { requiresApproval } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (group) => {
          // Group page underneath, pay screen on top (back returns to the group)
          router.replace({ pathname: '/group/[id]', params: { id: group.id } });
          router.push({ pathname: '/pay/[groupId]', params: { groupId: group.id } });
        },
      },
    );
  };

  if (productError && !product) {
    return (
      <StackScreen title={t('createGroup.title')}>
        <QueryErrorState error={productError} onRetry={() => refetchProduct()} />
      </StackScreen>
    );
  }
  if (!product || similar.isPending) {
    return (
      <StackScreen title={t('createGroup.title')}>
        <View className="gap-4" accessibilityLabel={t('common.loading')}>
          <Skeleton className="h-8 w-2/3 rounded-button" />
          <Skeleton className="h-40 rounded-card" />
        </View>
      </StackScreen>
    );
  }

  const variantName = product.variants.find((variant) => variant.key === variantKey)?.name;

  return (
    <StackScreen title={t('createGroup.title')}>
      <AppText variant="label">{t('createGroup.forProduct')}</AppText>
      <AppText variant="heading" className="mt-1">
        {product.name}
      </AppText>

      {currentStep === 'similar' ? (
        <Animated.View entering={enterUp(0)} className="mt-6 gap-4">
          <View className="gap-1">
            <AppText variant="heading">{t('createGroup.similarTitle')}</AppText>
            <AppText variant="body" color="muted">
              {t('createGroup.similarBody')}
            </AppText>
          </View>
          {similar.data?.map((group) => (
            <GroupCard key={group.id} group={group} hideProduct />
          ))}
          <Button
            label={t('createGroup.startOwn')}
            icon={ArrowRight}
            variant="secondary"
            onPress={() => setSkipSimilar(true)}
          />
        </Animated.View>
      ) : null}

      {currentStep === 'details' ? (
        <Animated.View entering={enterUp(0)} className="mt-6 gap-7">
          {product.variants.length ? (
            <View className="gap-3">
              <AppText variant="bodyStrong">{t('createGroup.variant')}</AppText>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label={t('group.anyVariant')}
                  role="radio"
                  selected={variantKey === null}
                  onPress={() => setVariantKey(null)}
                />
                {product.variants.map((variant) => (
                  <Chip
                    key={variant.key}
                    label={variant.name}
                    role="radio"
                    selected={variantKey === variant.key}
                    onPress={() => setVariantKey(variant.key)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View className="gap-3">
            <AppText variant="bodyStrong">{t('createGroup.size')}</AppText>
            <Stepper
              value={targetSize}
              min={minSize}
              max={maxSize}
              onChange={setSize}
              label={t('createGroup.size')}
            />
            <AppText variant="caption">
              {t('createGroup.sizeHint', { min: minSize, max: maxSize })}
            </AppText>
          </View>

          <View className="gap-3">
            <AppText variant="bodyStrong">{t('createGroup.deadline')}</AppText>
            <View className="flex-row flex-wrap gap-2">
              {deadlineOptions.map((option) => (
                <Chip
                  key={option}
                  label={t('createGroup.days', { count: option })}
                  role="radio"
                  selected={days === option}
                  onPress={() => setDeadlineDays(option)}
                />
              ))}
            </View>
          </View>

          <View className="gap-3">
            <AppText variant="bodyStrong">{t('createGroup.whoCanJoin')}</AppText>
            <View className="flex-row flex-wrap gap-2">
              <Chip
                label={t('createGroup.public')}
                icon={UsersRound}
                role="radio"
                selected={visibility === 'public'}
                onPress={() => setVisibility('public')}
              />
              <Chip
                label={t('createGroup.community')}
                icon={Lock}
                role="radio"
                selected={visibility === 'community'}
                onPress={() => setVisibility('community')}
              />
            </View>
            <AppText variant="caption">
              {visibility === 'public'
                ? t('createGroup.publicHint')
                : t('createGroup.communityHint')}
            </AppText>
            {visibility === 'community' ? (
              <View className="min-h-12 flex-row items-center gap-3 rounded-card border border-line bg-surface px-4 py-2">
                <AppText variant="body" className="flex-1">
                  {t('createGroup.approval')}
                </AppText>
                <Switch
                  value={requiresApproval}
                  onValueChange={setRequiresApproval}
                  trackColor={{ true: brand.primary }}
                  accessibilityLabel={t('createGroup.approval')}
                />
              </View>
            ) : null}
          </View>

          <TextField
            label={t('createGroup.note')}
            value={note}
            onChangeText={setNote}
            placeholder={t('createGroup.notePlaceholder')}
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          <Button
            label={t('createGroup.review')}
            icon={ArrowRight}
            onPress={() => setStep('review')}
          />
        </Animated.View>
      ) : null}

      {currentStep === 'review' ? (
        <Animated.View entering={enterUp(0)} className="mt-6 gap-5">
          <View className="overflow-hidden rounded-card border border-line bg-surface">
            {[
              [t('createGroup.variant'), variantName ?? t('group.anyVariant')],
              [t('createGroup.size'), t('createGroup.people', { count: targetSize })],
              [t('createGroup.deadline'), t('createGroup.days', { count: days })],
              [
                t('createGroup.whoCanJoin'),
                visibility === 'public'
                  ? t('createGroup.public')
                  : requiresApproval
                    ? t('createGroup.communityApproval')
                    : t('createGroup.community'),
              ],
              ...(category?.rules.tokenAmountPaise != null
                ? [[t('group.tokenLabel'), formatINR(category.rules.tokenAmountPaise)]]
                : []),
            ].map(([label, value], index) => (
              <View
                key={label}
                className={`flex-row justify-between gap-4 px-4 py-3 ${index > 0 ? 'border-t border-line' : ''}`}
              >
                <AppText variant="body" color="muted">
                  {label}
                </AppText>
                <AppText variant="bodyStrong" className="flex-1 text-right">
                  {value}
                </AppText>
              </View>
            ))}
          </View>
          <Notice tone="info" message={t('createGroup.tokenNote')} />
          {create.error ? <Notice message={t(getErrorMessageKey(create.error))} /> : null}
          <Button
            label={t('createGroup.create')}
            icon={UsersRound}
            loading={create.isPending}
            onPress={submit}
          />
          <Button
            label={t('createGroup.edit')}
            variant="ghost"
            onPress={() => setStep('details')}
          />
        </Animated.View>
      ) : null}
    </StackScreen>
  );
}
