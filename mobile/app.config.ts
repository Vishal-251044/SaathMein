/**
 * Dynamic Expo config. Extends app.json with values that depend on the environment:
 * - Firebase (phone OTP) native plugins are added only when google-services.json exists,
 *   so the project still builds and runs before Firebase is set up.
 * - On EAS, upload google-services.json as a "file" environment variable named
 *   GOOGLE_SERVICES_JSON; locally, put it at mobile/google-services.json (gitignored).
 */
/// <reference types="node" />
import { existsSync } from 'fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const FIREBASE_PLUGINS = ['@react-native-firebase/app', '@react-native-firebase/auth'];

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
  const hasFirebaseConfig = existsSync(googleServicesFile);

  if (!hasFirebaseConfig) {
    // Shown when running expo start / prebuild; phone login stays disabled until fixed
    console.warn(
      '[app.config] google-services.json not found — Firebase phone login is disabled in native builds.',
    );
  }

  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  // Android App Links: https://<host>/g/<code> opens the app (verified by the backend's
  // /.well-known/assetlinks.json on that host). Host from EXPO_PUBLIC_APP_LINK_HOST.
  const appLinkHost = process.env.EXPO_PUBLIC_APP_LINK_HOST;
  const appLinkFilters = appLinkHost
    ? [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            { scheme: 'https', host: appLinkHost, pathPrefix: '/g/' },
            { scheme: 'https', host: appLinkHost, pathPrefix: '/r/' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ]
    : [];

  return {
    ...config,
    name: config.name ?? 'SaathMein',
    slug: config.slug ?? 'saathmein',
    android: {
      ...config.android,
      ...(hasFirebaseConfig ? { googleServicesFile } : {}),
      intentFilters: [...(config.android?.intentFilters ?? []), ...appLinkFilters],
    },
    plugins: [
      ...(config.plugins ?? []),
      // Push notifications (Expo + FCM); icon colour = Sunrise primary
      ['expo-notifications', { color: '#FF5A3C' }],
      // Google sign-in (F4): Android reads the OAuth client from google-services.json
      '@react-native-google-signin/google-signin',
      ...(hasFirebaseConfig ? FIREBASE_PLUGINS : []),
      // Native crash reporting + source maps upload, only when the EAS build has the Sentry
      // org / project (and SENTRY_AUTH_TOKEN as an EAS secret); JS errors are reported anyway
      ...(sentryOrg && sentryProject
        ? [
            ['@sentry/react-native', { organization: sentryOrg, project: sentryProject }] as [
              string,
              object,
            ],
          ]
        : []),
    ],
  };
};
