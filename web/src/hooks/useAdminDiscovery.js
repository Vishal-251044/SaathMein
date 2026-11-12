'use client';

/**
 * useAdminDiscovery — TanStack Query hooks for Admin → Curation (banners, featured groups,
 * category order) and Admin → Settings.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as discoveryService from '@/services/adminDiscovery.service';

const CURATION_KEY = ['admin', 'curation'];
const SETTINGS_KEY = ['admin', 'settings'];

/** @returns Query with every curation item */
export function useCuration() {
  return useQuery({ queryKey: CURATION_KEY, queryFn: () => discoveryService.listCuration() });
}

/** Mutation that refreshes the curation list. */
const useCurationMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURATION_KEY }),
  });
};

/** @returns Mutation `item` */
export const useCreateCuration = () => useCurationMutation(discoveryService.createCuration);
/** @returns Mutation `{ itemId, changes }` */
export const useUpdateCuration = () => useCurationMutation(discoveryService.updateCuration);
/** @returns Mutation `itemId` */
export const useDeleteCuration = () => useCurationMutation(discoveryService.deleteCuration);

/** @returns Mutation `[{ id, order }]` that also refreshes the admin category list */
export function useSaveCategoryOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: discoveryService.saveCategoryOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
}

/** @returns Query with every settings section */
export function useAdminSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: discoveryService.getSettings });
}

/** @returns Mutation `{ key, changes }` that writes the saved values into the cache */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: discoveryService.updateSettings,
    onSuccess: (values, { key }) =>
      queryClient.setQueryData(SETTINGS_KEY, (current) =>
        current ? { ...current, [key]: { ...current[key], values } } : current,
      ),
  });
}
