/**
 * Catalog hooks — cached categories and cities (TanStack Query). These change rarely,
 * so they stay fresh for 30 minutes.
 */
import { useQuery } from '@tanstack/react-query';

import { getCategories, getCities } from '@/services/catalog.service';

const THIRTY_MINUTES = 30 * 60 * 1000;

/** @returns Query with the active category tree */
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: getCategories, staleTime: THIRTY_MINUTES });
}

/** @returns Query with active launch cities */
export function useCities() {
  return useQuery({ queryKey: ['cities'], queryFn: getCities, staleTime: THIRTY_MINUTES });
}
