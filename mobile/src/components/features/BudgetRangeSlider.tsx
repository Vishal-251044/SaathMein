/**
 * BudgetRangeSlider — two-thumb range slider for the buying budget (ACC-3).
 * Logarithmic scale from ₹10,000 to ₹50 lakh so phones and cars both fit; values snap to
 * round amounts. Drag anywhere on the track: the nearest thumb follows the finger.
 * Built on Gesture Handler v3 + Reanimated (UI thread, 60 fps). Thumbs are also adjustable
 * with accessibility actions (increment / decrement) for screen-reader users.
 */
import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui/AppText';
import { budgetToPosition, formatBudgetShort, positionToBudget, snapBudget } from '@/utils/budget';

const THUMB_SIZE = 28;
const MIN_GAP = 0.04; // thumbs never overlap
const A11Y_STEP = 0.05;

interface BudgetRangeSliderProps {
  minPaise: number;
  maxPaise: number;
  onChange: (range: { minPaise: number; maxPaise: number }) => void;
  label: string;
  minLabel: string;
  maxLabel: string;
}

/**
 * @param props.minPaise - Current minimum budget (paise)
 * @param props.maxPaise - Current maximum budget (paise)
 * @param props.onChange - Called with snapped values while dragging
 */
export function BudgetRangeSlider({
  minPaise,
  maxPaise,
  onChange,
  label,
  minLabel,
  maxLabel,
}: BudgetRangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useSharedValue(0);
  const low = useSharedValue(budgetToPosition(minPaise));
  const high = useSharedValue(budgetToPosition(maxPaise));
  const activeThumb = useSharedValue<'low' | 'high'>('low');

  /** Report snapped values to React (called from the UI thread). */
  const emit = (lowPosition: number, highPosition: number) => {
    onChange({
      minPaise: snapBudget(positionToBudget(lowPosition)),
      maxPaise: snapBudget(positionToBudget(highPosition)),
    });
  };

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (event) => {
      'worklet';
      if (width.get() <= 0) return;
      const position = event.x / width.get();
      // Grab whichever thumb is closer to the finger
      activeThumb.set(
        Math.abs(position - low.get()) <= Math.abs(position - high.get()) ? 'low' : 'high',
      );
    },
    onUpdate: (event) => {
      'worklet';
      if (width.get() <= 0) return;
      const position = Math.min(1, Math.max(0, event.x / width.get()));
      if (activeThumb.get() === 'low') low.set(Math.min(position, high.get() - MIN_GAP));
      else high.set(Math.max(position, low.get() + MIN_GAP));
      scheduleOnRN(emit, low.get(), high.get());
    },
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    width.set(measured);
    setTrackWidth(measured);
  };

  const fillStyle = useAnimatedStyle(() => ({
    left: low.get() * width.get(),
    width: (high.get() - low.get()) * width.get(),
  }));
  const lowThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: low.get() * width.get() - THUMB_SIZE / 2 }],
  }));
  const highThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: high.get() * width.get() - THUMB_SIZE / 2 }],
  }));

  /** Screen-reader adjustment of one thumb. */
  const adjust = (thumb: 'low' | 'high', direction: 1 | -1) => {
    if (thumb === 'low')
      low.set(Math.min(Math.max(0, low.get() + direction * A11Y_STEP), high.get() - MIN_GAP));
    else high.set(Math.max(Math.min(1, high.get() + direction * A11Y_STEP), low.get() + MIN_GAP));
    emit(low.get(), high.get());
  };

  const a11yActions = [
    { name: 'increment' as const, label: '+' },
    { name: 'decrement' as const, label: '-' },
  ];

  return (
    <View accessibilityLabel={label}>
      <View className="mb-3 flex-row justify-between">
        <View>
          <AppText variant="label">{minLabel}</AppText>
          <AppText variant="heading" mono>
            {formatBudgetShort(minPaise)}
          </AppText>
        </View>
        <View className="items-end">
          <AppText variant="label">{maxLabel}</AppText>
          <AppText variant="heading" mono>
            {formatBudgetShort(maxPaise)}
          </AppText>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        {/* Tall touch area around a thin track */}
        <View
          className="h-12 justify-center"
          style={{ marginHorizontal: THUMB_SIZE / 2 }}
          onLayout={handleLayout}
        >
          <View className="h-1.5 rounded-full bg-line" />
          <Animated.View className="absolute h-1.5 rounded-full bg-primary" style={fillStyle} />
          {trackWidth > 0 ? (
            <>
              <Animated.View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={minLabel}
                accessibilityValue={{ text: formatBudgetShort(minPaise) }}
                accessibilityActions={a11yActions}
                onAccessibilityAction={(event) =>
                  adjust('low', event.nativeEvent.actionName === 'increment' ? 1 : -1)
                }
                className="absolute rounded-full border-4 border-primary bg-surface"
                style={[{ width: THUMB_SIZE, height: THUMB_SIZE }, lowThumbStyle]}
              />
              <Animated.View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={maxLabel}
                accessibilityValue={{ text: formatBudgetShort(maxPaise) }}
                accessibilityActions={a11yActions}
                onAccessibilityAction={(event) =>
                  adjust('high', event.nativeEvent.actionName === 'increment' ? 1 : -1)
                }
                className="absolute rounded-full border-4 border-primary bg-surface"
                style={[{ width: THUMB_SIZE, height: THUMB_SIZE }, highThumbStyle]}
              />
            </>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}
