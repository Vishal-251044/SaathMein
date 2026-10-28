/**
 * Root layout for the SaathMein web app (public site, dealer dashboard, admin console).
 * Loads the brand fonts and global Sunrise styles.
 */
import { Plus_Jakarta_Sans, JetBrains_Mono, Noto_Sans_Devanagari } from 'next/font/google';
import { APP_NAME, APP_TAGLINE } from '@/utils/constants';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

// Hindi / Marathi text (seller names, product names); not preloaded to keep pages light
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
  preload: false,
});

export const metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Group buying for India. Join a group, let verified dealers bid, and the lowest price wins for everyone.',
  applicationName: APP_NAME,
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // allow env(safe-area-inset-*) on notched phones
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#12131F' },
  ],
};

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 * @returns {JSX.Element}
 */
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jetbrains.variable} ${devanagari.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
