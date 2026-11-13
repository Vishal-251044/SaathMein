/**
 * GroupRail — one home section (DIS-1) as a swipeable row of group cards, with a
 * "See all" link to the filtered browse screen.
 */
import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GroupCard } from '@/components/features/GroupCard';
import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { GroupCard as GroupCardData } from '@/types/group';
import { enterRight, enterUp } from '@/utils/animations';

interface GroupRailProps {
  title: string;
  groups: GroupCardData[];
  /** Browse screen with this section's filter, or none. */
  seeAllHref?: Href;
  index: number;
}

/** @returns Section with a horizontal list */
export function GroupRail({ title, groups, seeAllHref, index }: GroupRailProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.82, 340);

  return (
    <Animated.View entering={enterUp(index)} className="mt-8 gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <AppText variant="heading" className="flex-1" accessibilityRole="header">
          {title}
        </AppText>
        {seeAllHref ? (
          <Pressable
            onPress={() => router.push(seeAllHref)}
            accessibilityRole="link"
            accessibilityLabel={t('home.seeAllA11y', { section: title })}
            className="min-h-12 flex-row items-center gap-0.5 px-1"
          >
            <AppText variant="bodyStrong" color="primary">
              {t('home.seeAll')}
            </AppText>
            <ChevronRight size={18} color={colors.ink} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={groups}
        keyExtractor={(group) => group.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 16 }}
        className="-mx-4 px-4"
        renderItem={({ item, index: position }) => (
          <Animated.View entering={enterRight(position)} style={{ width: cardWidth }}>
            <GroupCard group={item} />
          </Animated.View>
        )}
      />
    </Animated.View>
  );
}
