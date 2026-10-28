/**
 * Profile → Edit profile: photo and name (ACC-2). Language is changed on the Profile tab.
 */
import { router } from 'expo-router';
import { Camera, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { StackScreen } from '@/components/layout/StackScreen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/hooks/useProfile';
import { pickAvatarImage } from '@/lib/imagePicker';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessageKey } from '@/utils/errorMessages';

const MIN_NAME_LENGTH = 2;

/**
 * @returns Edit profile screen
 */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState(user?.name ?? '');
  const [photoErrorKey, setPhotoErrorKey] = useState<string | null>(null);
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length >= MIN_NAME_LENGTH;

  /** Pick, resize and upload a new photo. */
  const changePhoto = async () => {
    setPhotoErrorKey(null);
    try {
      const image = await pickAvatarImage();
      if (image) await uploadAvatar.mutateAsync(image);
    } catch (error) {
      setPhotoErrorKey(
        (error as Error).message === 'PHOTO_PERMISSION_DENIED'
          ? 'profile.photoPermissionDenied'
          : getErrorMessageKey(error),
      );
    }
  };

  return (
    <StackScreen title={t('profile.editTitle')}>
      <View className="items-center gap-4">
        <Avatar url={user?.avatar?.url} name={user?.name} size={112} />
        <View className="w-full flex-row gap-3">
          <Button
            label={user?.avatar ? t('profile.changePhoto') : t('profile.addPhoto')}
            icon={Camera}
            variant="secondary"
            onPress={changePhoto}
            loading={uploadAvatar.isPending}
            className="flex-1"
          />
          {user?.avatar ? (
            <Button
              label={t('profile.removePhoto')}
              icon={Trash2}
              variant="ghost"
              onPress={() => removeAvatar.mutate()}
              loading={removeAvatar.isPending}
            />
          ) : null}
        </View>
        {photoErrorKey ? <Notice message={t(photoErrorKey)} className="w-full" /> : null}
      </View>

      <View className="mt-8 gap-6">
        <TextField
          label={t('profile.name')}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          maxLength={80}
          returnKeyType="done"
          error={name.length > 0 && !isNameValid ? t('profile.nameTooShort') : null}
        />
        {updateProfile.error ? (
          <Notice message={t(getErrorMessageKey(updateProfile.error))} />
        ) : null}
        <Button
          label={t('common.save')}
          loading={updateProfile.isPending}
          disabled={!isNameValid || trimmedName === (user?.name ?? '')}
          onPress={() =>
            updateProfile.mutate({ name: trimmedName }, { onSuccess: () => router.back() })
          }
        />
      </View>
    </StackScreen>
  );
}
