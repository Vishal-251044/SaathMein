'use client';

/**
 * QueryProvider — one TanStack Query client per browser session.
 */
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/queryClient';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - App content
 * @returns {JSX.Element}
 */
export default function QueryProvider({ children }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
