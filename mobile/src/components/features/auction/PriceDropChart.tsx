/**
 * PriceDropChart — small step chart of the falling auction price (AUC-9): one point per
 * new lowest price, starting from the market price. Decorative: the numbers next to it
 * carry the meaning, so screen readers get a one-line summary.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useThemeColors } from '@/hooks/useThemeColors';
import { brand } from '@/theme/tokens';
import { formatINR } from '@/utils/genericFunctions';

const HEIGHT = 96;
const PAD = 6;

interface Props {
  /** Market price the auction started from (first point). */
  ceilingPaise: number | null;
  history: { pricePaise: number; at: string }[];
}

/** @returns Chart, or nothing before the first bid */
export function PriceDropChart({ ceilingPaise, history }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [width, setWidth] = useState(0);
  if (!history.length) return null;

  const prices = [
    ...(ceilingPaise ? [ceilingPaise] : []),
    ...history.map((point) => point.pricePaise),
  ];
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const range = Math.max(1, max - min);
  const stepX = prices.length > 1 ? (width - PAD * 2) / (prices.length - 1) : 0;
  const x = (index: number) => PAD + index * stepX;
  const y = (price: number) => PAD + ((max - price) / range) * (HEIGHT - PAD * 2);

  // Step line: the price holds until the next lower bid
  const path = prices
    .map((price, index) => (index === 0 ? `M ${x(0)} ${y(price)}` : `H ${x(index)} V ${y(price)}`))
    .join(' ');
  const last = prices.length - 1;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={t('auction.chartA11y', {
        from: formatINR(prices[0]),
        to: formatINR(prices[last]),
        count: history.length,
      })}
      style={{ height: HEIGHT }}
    >
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Line
            x1={PAD}
            x2={width - PAD}
            y1={HEIGHT - PAD}
            y2={HEIGHT - PAD}
            stroke={colors.line}
            strokeWidth={1}
          />
          <Path
            d={path}
            stroke={brand.primary}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
          />
          <Circle cx={x(last)} cy={y(prices[last])} r={5} fill={brand.primary} />
        </Svg>
      ) : null}
    </View>
  );
}
