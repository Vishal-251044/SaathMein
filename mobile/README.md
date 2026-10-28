# SaathMein Buyer App

React Native + Expo (TypeScript) Android app for buyers. Expo Router, NativeWind (Tailwind), Reanimated, TanStack Query, Zustand, i18next (English, Hindi, Marathi).

```bash
cp .env.example .env       # set EXPO_PUBLIC_API_URL (use your LAN IP on a real phone)
npm install
npx expo start             # scan the QR code with Expo Go, or press "a" for an Android emulator
npm run lint
npm run typecheck
```

From Day 7 the Razorpay SDK needs an **EAS development build** (it does not run in Expo Go):

```bash
npx eas-cli@latest login
npx eas-cli@latest init                               # links this app to your Expo account
npx eas-cli@latest build --profile development --platform android
```

Design tokens: `src/theme/palette.js` (Sunrise theme, PRD §14.1). Project rules: see the root `CLAUDE.md`.
