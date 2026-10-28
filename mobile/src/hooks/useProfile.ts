/**
 * Profile mutations (TanStack Query). Each one stores the updated user from the API in the
 * auth store, so every screen (and the onboarding route guard) updates immediately.
 */
import { useMutation } from '@tanstack/react-query';

import type { PickedImage } from '@/lib/imagePicker';
import * as userService from '@/services/user.service';
import { useAuthStore } from '@/stores/auth.store';

/** @returns Mutation for name / language / city / area / pincode */
export function useUpdateProfile() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({ mutationFn: userService.updateProfile, onSuccess: setUser });
}

/** @returns Mutation that saves interests (or skips with empty lists) */
export function useSaveInterests() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({ mutationFn: userService.saveInterests, onSuccess: setUser });
}

/** @returns Mutation that uploads and attaches a new profile photo */
export function useUploadAvatar() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({
    mutationFn: (image: PickedImage) => userService.uploadAvatar(image),
    onSuccess: setUser,
  });
}

/** @returns Mutation that removes the profile photo */
export function useRemoveAvatar() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({ mutationFn: userService.removeAvatar, onSuccess: setUser });
}

/** @returns Mutation that deletes the account and signs out on this phone */
export function useDeleteAccount() {
  const clearAfterAccountDeletion = useAuthStore((state) => state.clearAfterAccountDeletion);
  return useMutation({
    mutationFn: userService.deleteAccount,
    onSuccess: clearAfterAccountDeletion,
  });
}
