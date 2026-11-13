'use client';

/**
 * Last-resort error page (an error in the root layout). Reports the error to Sentry when
 * it is configured and offers a reload. Must render its own <html> and <body>.
 */
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * @param {Object} props
 * @param {Error & { digest?: string }} props.error - The error
 * @param {() => void} props.reset - Try rendering again
 * @returns {JSX.Element}
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#F7F5F1',
          color: '#12131F',
          padding: 16,
          textAlign: 'center',
        }}
      >
        <main>
          <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#6B7085' }}>We have been told about it. Please try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: 44,
              padding: '0 20px',
              borderRadius: 14,
              border: 'none',
              background: '#FF5A3C',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
