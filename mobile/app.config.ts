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

  return {
    ...config,
    name: config.name ?? 'SaathMein',
    slug: config.slug ?? 'saathmein',
    android: {
      ...config.android,
      ...(hasFirebaseConfig ? { googleServicesFile } : {}),
    },
    plugins: [...(config.plugins ?? []), ...(hasFirebaseConfig ? FIREBASE_PLUGINS : [])],
  };
};
