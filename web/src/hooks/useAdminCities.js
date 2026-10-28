'use client';

/**
 * useAdminCities — TanStack Query hooks for Admin → Cities.
 * Mutations update the cached list with the city the API returns (no full refetch).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as citiesService from '@/services/adminCities.service';

export const ADMIN_CITIES_KEY = ['admin', 'cities'];

/** @returns Query with every city */
export function useAdminCities() {
  return useQuery({ queryKey: ADMIN_CITIES_KEY, queryFn: citiesService.listCities });
}

/**
 * Replace (or add) one city in the cached list.
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {Object} city - City from the API
 */
const upsertCachedCity = (queryClient, city) => {
  queryClient.setQueryData(ADMIN_CITIES_KEY, (cities = []) => {
    const exists = cities.some((item) => item.id === city.id);
    const next = exists
      ? cities.map((item) => (item.id === city.id ? city : item))
      : [...cities, city];
    return next.sort((a, b) => a.name.localeCompare(b.name));
  });
};

/** @returns Mutation that creates a city */
export function useCreateCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: citiesService.createCity,
    onSuccess: (city) => upsertCachedCity(queryClient, city),
  });
}

/** @returns Mutation `{ cityId, changes }` that updates a city */
export function useUpdateCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, changes }) => citiesService.updateCity(cityId, changes),
    onSuccess: (city) => upsertCachedCity(queryClient, city),
  });
}

/** @returns Mutation `{ cityId, area }` that adds an area */
export function useAddArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, area }) => citiesService.addArea(cityId, area),
    onSuccess: (city) => upsertCachedCity(queryClient, city),
  });
}

/** @returns Mutation `{ cityId, areaId, changes }` that edits an area */
export function useUpdateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, areaId, changes }) => citiesService.updateArea(cityId, areaId, changes),
    onSuccess: (city) => upsertCachedCity(queryClient, city),
  });
}
