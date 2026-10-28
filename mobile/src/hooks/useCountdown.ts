/**
 * useCountdown — seconds left until a deadline, updated every second.
 * Used for the OTP "Resend code in 30 s" timer (and later for group deadlines).
 */
import { useCallback, useEffect, useState } from 'react';

/**
 * @param initialSeconds - Length of the countdown
 * @returns Seconds left and a function to restart the countdown
 */
export function useCountdown(initialSeconds: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + initialSeconds * 1000);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const restart = useCallback(() => {
    setEndsAt(Date.now() + initialSeconds * 1000);
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  return { secondsLeft, isDone: secondsLeft === 0, restart };
}
