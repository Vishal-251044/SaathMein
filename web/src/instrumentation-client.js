/**
 * Browser-side Sentry for the dealer dashboard and admin console (Day 14). Off unless
 * NEXT_PUBLIC_SENTRY_DSN is a real DSN. No default PII: cookies, headers, query strings
 * and the user are stripped, so tokens, phone numbers and emails never leave the browser.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

if (dsn.startsWith('https://')) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
      }
      return event;
    },
  });
}

/** Lets Sentry name page navigations (no-op when Sentry is off). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
