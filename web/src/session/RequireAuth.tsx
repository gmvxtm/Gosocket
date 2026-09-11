import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UnauthorizedError } from '../api';
import { useSession } from './SessionContext';

/**
 * Guards the private routes. It also watches the cache: a token that expires while the app is
 * open shows up as a 401 on any query, and that has to end the session instead of leaving the
 * screen stuck on an error.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const client = useQueryClient();
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.query.state.error instanceof UnauthorizedError) signOut(t('session.expired'));
    });
    return unsubscribe;
  }, [client, signOut, t]);

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}
