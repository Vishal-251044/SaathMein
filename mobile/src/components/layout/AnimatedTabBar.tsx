/**
 * AnimatedTabBar — the bottom tab bar (CLAUDE.md §10 native patterns, §11 motion): a soft
 * pill slides to the active tab with a spring, the active icon lifts and grows a little,
 * and a selection haptic ticks on change. Saathi's pill and icon are violet (violet = AI).
 * Every tab is at least 48 dp tall; motion follows the reduce-motion setting.
 */
import type { BottomTabBarProps } from 'expo-router/tabs';
import { CircleUserRound, House, Search, Sparkles, UsersRound } from 'lucide-react-native';
import { type ComponentType, useEffect, useState } from 'react';
import { type ColorValue, type LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { tapSelection } from '@/lib/haptics';
import { DURATION, SPRING_BOUNCY } from '@/utils/animations';

type LucideIcon = ComponentType<{ size?: number; color?: ColorValue; strokeWidth?: number }>;

/** Icon per tab route. */
const ICONS: Record<string, LucideIcon> = {
  index: House,
  search: Search,
  groups: UsersRound,
  saathi: Sparkles,
  profile: CircleUserRound,
};

const PILL_WIDTH = 64;
const PILL_HEIGHT = 32;

/** One tab: icon (lifts when active) + label. */
function TabItem({
  label,
  Icon,
  focused,
  color,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  label: string;
  Icon: LucideIcon;
  focused: boolean;
  color: string;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.set(
      reduceMotion
        ? withTiming(focused ? 1 : 0, { duration: DURATION.fast })
        : withSpring(focused ? 1 : 0, SPRING_BOUNCY),
    );
  }, [focused, reduceMotion, active]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * active.get() }, { scale: 1 + 0.12 * active.get() }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      className="min-h-12 flex-1 items-center justify-center gap-1 pb-1 pt-2"
    >
      <View style={{ height: PILL_HEIGHT, justifyContent: 'center' }}>
        <Animated.View style={iconStyle}>
          <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.9} />
        </Animated.View>
      </View>
      <AppText
        variant="label"
        numberOfLines={1}
        style={{ color, fontSize: 11 }}
        weight={focused ? 'bold' : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * @param props - Tab bar props from Expo Router's Tabs
 * @returns The animated bottom tab bar
 */
export function AnimatedTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const { colors } = useThemeColors();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const itemWidth = count ? width / count : 0;
  const position = useSharedValue(state.index);
  const isSaathi = state.routes[state.index]?.name === 'saathi';

  useEffect(() => {
    position.set(
      reduceMotion
        ? withTiming(state.index, { duration: DURATION.fast })
        : withSpring(state.index, SPRING_BOUNCY),
    );
  }, [state.index, reduceMotion, position]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * itemWidth + (itemWidth - PILL_WIDTH) / 2 }],
  }));

  return (
    <View
      className="border-t border-line bg-surface"
      style={{ paddingBottom: Math.max(insets.bottom, 6) }}
      role="tablist"
    >
      <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {width ? (
          <Animated.View
            pointerEvents="none"
            className={isSaathi ? 'bg-ai-soft' : 'bg-primary/10'}
            style={[
              {
                position: 'absolute',
                top: 8,
                left: 0,
                width: PILL_WIDTH,
                height: PILL_HEIGHT,
                borderRadius: PILL_HEIGHT / 2,
              },
              pillStyle,
            ]}
          />
        ) : null}
        <View className="flex-row">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = index === state.index;
            const label = typeof options.title === 'string' ? options.title : route.name;
            // Text shades keep the label readable (WCAG AA); violet = AI for Saathi
            const activeColor = route.name === 'saathi' ? colors.aiText : colors.primaryText;
            const Icon = ICONS[route.name] ?? House;

            const onPress = () => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                tapSelection();
                navigateToTab(route.key);
              }
            };
            const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });

            return (
              <TabItem
                key={route.key}
                label={label}
                Icon={Icon}
                focused={focused}
                color={focused ? activeColor : colors.muted}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
