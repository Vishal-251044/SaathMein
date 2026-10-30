'use client';

/**
 * useAdminGroups — TanStack Query hook for Admin → Groups (read-only).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as groupsService from '@/services/adminGroups.service';

/** @param {Object} filters - Admin group filters @returns Paginated groups query */
export function useAdminGroups(filters) {
  return useQuery({
    queryKey: ['admin', 'groups', filters],
    queryFn: () => groupsService.listGroups(filters),
    placeholderData: keepPreviousData,
  });
}
