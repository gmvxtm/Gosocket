import { useTranslation } from 'react-i18next';
import type { RequestStatus } from '../api';

/** One place decides how a status looks and reads, so every screen says the same thing. */
export function StatusPill({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  return <span className={'pill ' + status.toLowerCase()}>{t('status.' + status.toLowerCase())}</span>;
}
