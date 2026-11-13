/**
 * Next.js config for the dealer dashboard, admin console and public site.
 * Share links (LIV-4): the public domain serves https://<domain>/g/<code> and Android's
 * /.well-known/assetlinks.json from the backend, so links shared on WhatsApp open the app
 * (App Links) or the landing page — without a separate domain for the API.
 */

// Backend origin = API URL without the trailing /api
const backendOrigin = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api').replace(
  /\/api\/?$/,
  '',
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // Security headers on every page (Day 14 hardening). The console must never be framed.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/g/:code', destination: `${backendOrigin}/g/:code` },
      // Referral links (REF-1) are served by the backend too
      { source: '/r/:code', destination: `${backendOrigin}/r/:code` },
      {
        source: '/.well-known/assetlinks.json',
        destination: `${backendOrigin}/.well-known/assetlinks.json`,
      },
    ];
  },
};

export default nextConfig;
