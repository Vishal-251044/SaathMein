/**
 * Sentry crash and error reporting for the buyer app (Day 14). Off unless
 * EXPO_PUBLIC_SENTRY_DSN is a real DSN (the DSN is public by design; it is not a secret).
 * Privacy: no default PII; the user, request data and breadcrumbs that could hold phone
 * numbers, OTPs, tokens or payment details are dropped before sending.
 */
import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const enabled = DSN.startsWith('https://');

if (enabled) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Network breadcrumbs carry URLs with ids and query strings; console ones may echo input
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb.category === 'xhr' ||
      breadcrumb.category === 'fetch' ||
      breadcrumb.category === 'console'
        ? null
        : breadcrumb,
    beforeSend: (event) => {
      delete event.user;
      delete event.request;
      return event;
    },
  });
}

/**
 * Wrap the root component so render crashes are reported (no-op wrapper when off).
 * @param component - The app's root layout
 * @returns The wrapped component
 */
export function withSentry<P extends Record<string, unknown>>(
  component: ComponentType<P>,
): ComponentType<P> {
  return enabled ? Sentry.wrap(component) : component;
}

/**
 * Report a handled error that should not happen (e.g. a failed payment verification).
 * @param error - The error
 */
export function reportError(error: unknown): void {
  if (enabled) Sentry.captureException(error);
}
