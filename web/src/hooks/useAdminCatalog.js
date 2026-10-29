'use client';

/**
 * useAdminCatalog — TanStack Query hooks for Admin → Categories and Products.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as catalogService from '@/services/adminCatalog.service';

export const ADMIN_CATEGORIES_KEY = ['admin', 'categories'];
export const ADMIN_PRODUCTS_KEY = ['admin', 'products'];

/** @returns Query with every category (flat list) */
export function useAdminCategories() {
  return useQuery({ queryKey: ADMIN_CATEGORIES_KEY, queryFn: catalogService.listCategories });
}

/** @returns Mutation `{ categoryId, changes }` that updates a category in the cache */
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, changes }) => catalogService.updateCategory(categoryId, changes),
    onSuccess: (category) =>
      queryClient.setQueryData(ADMIN_CATEGORIES_KEY, (list = []) =>
        list.map((item) => (item.id === category.id ? category : item)),
      ),
  });
}

/**
 * @param {{ q?: string, categoryId?: string, status?: string, page?: number }} filters
 * @returns Query with a page of products (keeps the previous page while loading)
 */
export function useAdminProducts(filters) {
  return useQuery({
    queryKey: [...ADMIN_PRODUCTS_KEY, 'list', filters],
    queryFn: () => catalogService.listProducts(filters),
    placeholderData: keepPreviousData,
  });
}

/** @param {string|null} productId @returns Query with one product (disabled for new products) */
export function useAdminProduct(productId) {
  return useQuery({
    queryKey: [...ADMIN_PRODUCTS_KEY, 'detail', productId],
    queryFn: () => catalogService.getProduct(productId),
    enabled: Boolean(productId),
  });
}

/**
 * Store a saved product in its detail cache and refresh product lists.
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {Object} product - Product from the API
 */
const cacheSavedProduct = (queryClient, product) => {
  queryClient.setQueryData([...ADMIN_PRODUCTS_KEY, 'detail', product.id], product);
  queryClient.invalidateQueries({ queryKey: [...ADMIN_PRODUCTS_KEY, 'list'] });
};

/** @returns Mutation `{ productId?, values }` that creates or updates a product */
export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, values }) =>
      productId
        ? catalogService.updateProduct(productId, values)
        : catalogService.createProduct(values),
    onSuccess: (product) => cacheSavedProduct(queryClient, product),
  });
}

/** @returns Mutation `{ productId, file }` that uploads and attaches an image */
export function useUploadProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, file }) => catalogService.uploadProductImage(productId, file),
    onSuccess: (product) => cacheSavedProduct(queryClient, product),
  });
}

/** @returns Mutation `{ productId, url }` that removes an image */
export function useRemoveProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, url }) => catalogService.removeProductImage(productId, url),
    onSuccess: (product) => cacheSavedProduct(queryClient, product),
  });
}

/** @returns Mutation `{ file, dryRun }` that imports a CSV */
export function useImportProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, dryRun }) => catalogService.importProducts(file, { dryRun }),
    onSuccess: (report) => {
      if (!report.dryRun) queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_KEY });
    },
  });
}
