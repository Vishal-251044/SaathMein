/**
 * QueryErrorState — the error state every screen and section uses when its data cannot
 * load: offline (no saved copy yet) or a server problem, always with "Try again".
 * Screens that have saved data keep showing it instead (see lib/queryPersist.ts).
 */
import { CloudOff, RotateCcw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/features/EmptyState';
import { Button } from '@/components/ui/Button';
import { useOnline } from '@/hooks/useOnline';
import { ApiClientError } from '@/services/api';

interface QueryErrorStateProps {
  /** The query error (network errors show the offline text). */
  error: unknown;
  /** Retry handler, usually `query.refetch`. */
  onRetry: () => void;
  className?: string;
}

/**
 * @param props.error - Error from the query
 * @param props.onRetry - Called by "Try again"
 */
export function QueryErrorState({ error, onRetry, className }: QueryErrorStateProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const isOffline = !online || (error instanceof ApiClientError && error.code === 'NETWORK_ERROR');

  return (
    <EmptyState
      icon={isOffline ? CloudOff : RotateCcw}
      title={isOffline ? t('states.offlineNoDataTitle') : t('states.loadFailedTitle')}
      body={isOffline ? t('states.offlineNoDataBody') : t('states.loadFailedBody')}
      className={className}
      action={<Button label={t('common.retry')} variant="secondary" onPress={onRetry} />}
    />
  );
}
