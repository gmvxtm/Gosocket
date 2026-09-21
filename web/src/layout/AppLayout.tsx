import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Database, HardDrive, Languages, LayoutDashboard, Layers, List, LogOut, Moon, PlusCircle, RefreshCw, Sun, Wifi, WifiOff } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import { languageChanged, themeToggled } from '../store/preferences';
import { useSession } from '../session/SessionContext';
import { localKeys, useRequests, useServiceHealth } from '../hooks/useRequests';
import { localStore } from '../local';
import type { Language } from '../i18n';

const tabs = [
  { to: '/status', key: 'status', Icon: LayoutDashboard },
  { to: '/requests/new', key: 'create', Icon: PlusCircle },
  { to: '/requests', key: 'requests', Icon: List },
  { to: '/groups', key: 'groups', Icon: Layers }
];

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { theme, language } = useAppSelector(state => state.preferences);
  const { session, signOut } = useSession();
  const client = useQueryClient();
  const health = useServiceHealth();
  const requests = useRequests();

  // The stored preference is the source of truth for both the document and i18next.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [i18n, language]);

  const online = health.isSuccess && health.data.status === 'Healthy';
  const pending = (requests.data ?? []).filter(request => request.status === 'Pending').length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>{t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>

        <div className="actions">
          <span className={'status ' + (online ? 'online' : 'offline')}>
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            {health.isPending ? t('service.checking') : online ? t('service.online') : t('service.offline')}
          </span>

          {/* Where the pending work is waiting is not a detail the user should have to guess. */}
          <span className="status" title={t('storage.' + localStore.mode + 'Hint')}>
            {localStore.mode === 'browser' ? <HardDrive size={16} /> : <Database size={16} />}
            {t('storage.' + localStore.mode)}
          </span>

          <label className="inline-field">
            <Languages size={16} aria-hidden="true" />
            <span className="sr-only">{t('actions.language')}</span>
            <select
              aria-label={t('actions.language')}
              value={language}
              onChange={event => dispatch(languageChanged(event.target.value as Language))}
            >
              <option value="es">Espanol</option>
              <option value="en">English</option>
            </select>
          </label>

          <button type="button" aria-label={t('actions.theme')} title={t('actions.theme')}
            onClick={() => dispatch(themeToggled())}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button type="button" aria-label={t('actions.refresh')} title={t('actions.refresh')}
            disabled={requests.isFetching}
            onClick={() => void client.invalidateQueries({ queryKey: localKeys.all })}>
            <RefreshCw size={18} />
          </button>

          <span className="user" title={session?.username}>{session?.displayName}</span>

          <button type="button" onClick={() => signOut()}>
            <LogOut size={18} />{t('session.signOut')}
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label={t('app.title')}>
        {tabs.map(({ to, key, Icon }) => (
          <NavLink key={to} to={to} end={to === '/requests'}
            className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            <Icon size={16} />
            {t('nav.' + key)}
            {key === 'status' && pending > 0 && <span className="badge">{pending}</span>}
          </NavLink>
        ))}
      </nav>

      <main className="workspace">
        <Outlet />
      </main>
    </div>
  );
}
