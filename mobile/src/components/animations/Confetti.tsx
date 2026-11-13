/**
 * Confetti — a short, small burst for "you saved" / tier unlocked moments (CLAUDE.md §11).
 * Pieces fly out from the centre, spin and fade (transform + opacity only) in under 1.2 s.
 * Renders nothing when the phone's reduce-motion setting is on.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { brand } from '@/theme/tokens';

const COLORS = [brand.saffron, brand.coral, brand.violet, '#10B981'];
const PIECES = 18;
const DURATION_MS = 1100;

interface PieceSpec {
  angle: number;
  distance: number;
  spin: number;
  delay: number;
  color: string;
  wide: boolean;
}

/** Random spread for every piece (fixed for the life of the burst). */
const makePieces = (): PieceSpec[] =>
  Array.from({ length: PIECES }, (_, index) => ({
    angle: (index / PIECES) * Math.PI * 2 + Math.random() * 0.4,
    distance: 60 + Math.random() * 70,
    spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
    delay: Math.random() * 120,
    color: COLORS[index % COLORS.length],
    wide: index % 3 === 0,
  }));

/** One flying piece. */
function Piece({ spec }: { spec: PieceSpec }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(
      withDelay(
        spec.delay,
        withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [spec.delay, t]);

  const style = useAnimatedStyle(() => {
    const progress = t.get();
    // Out along the angle, then a little gravity
    const x = Math.cos(spec.angle) * spec.distance * progress;
    const y = Math.sin(spec.angle) * spec.distance * progress + 40 * progress * progress;
    return {
      opacity: progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${spec.spin * progress}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: spec.wide ? 10 : 6,
          height: spec.wide ? 4 : 8,
          borderRadius: 2,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

/**
 * @param props.burstKey - Change it to fire another burst
 * @returns Burst layer (pointer events off; place inside a relative container)
 */
export function Confetti({ burstKey = 0 }: { burstKey?: number }) {
  const reduceMotion = useReducedMotion();
  const [pieces] = useState(makePieces);
  if (reduceMotion) return null;

  return (
    <View
      key={burstKey}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: '40%', left: '50%' }}
    >
      {pieces.map((spec, index) => (
        <Piece key={index} spec={spec} />
      ))}
    </View>
  );
}
