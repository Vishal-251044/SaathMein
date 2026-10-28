/**
 * LogoMark — the SaathMein app mark: three people above a smile on the Sunrise
 * gradient (PRD §14.1). The smile also reads as a price curve dipping down.
 */
import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { gradients } from '@/theme/tokens';

interface LogoMarkProps {
  size?: number;
}

/**
 * @param props.size - Width and height in dp (default 40)
 */
export function LogoMark({ size = 40 }: LogoMarkProps) {
  // Unique gradient id so several marks on one screen do not clash
  const gradientId = `sm-logo-${useId()}`;
  const [saffron, coral, violet] = gradients.sunrise;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="SaathMein">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={saffron} />
          <Stop offset="0.52" stopColor={coral} />
          <Stop offset="1" stopColor={violet} />
        </LinearGradient>
      </Defs>
      <Rect width="64" height="64" rx="19" fill={`url(#${gradientId})`} />
      <Circle cx="21.5" cy="24.5" r="5.3" fill="#FFFFFF" />
      <Circle cx="32" cy="19.5" r="5.3" fill="#FFFFFF" />
      <Circle cx="42.5" cy="24.5" r="5.3" fill="#FFFFFF" />
      <Path
        d="M16 37.5c4.6 6.9 10 10 16 10s11.4-3.1 16-10"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={5.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
