/**
 * RequestProductButton — "Request this product" link to the missing-product form (CAT-5),
 * shown when search or a category has no match, and on the Profile tab.
 */
import { router } from 'expo-router';
import { MessageSquarePlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';

interface RequestProductButtonProps {
  /** Pre-fills the model field (e.g. the search text). */
  query?: string;
  /** Pre-selects the category. */
  categoryId?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}

/**
 * @param props.query - Search text to pre-fill
 * @param props.categoryId - Category to pre-select
 */
export function RequestProductButton({
  query,
  categoryId,
  variant = 'secondary',
}: RequestProductButtonProps) {
  const { t } = useTranslation();
  return (
    <Button
      label={t('request.cta')}
      icon={MessageSquarePlus}
      variant={variant}
      onPress={() =>
        router.push({
          pathname: '/request-product',
          params: { ...(query ? { q: query } : {}), ...(categoryId ? { categoryId } : {}) },
        })
      }
    />
  );
}
