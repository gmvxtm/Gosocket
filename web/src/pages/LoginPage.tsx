import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn } from 'lucide-react';
import { useSession } from '../session/SessionContext';

export function LoginPage() {
  const { t } = useTranslation();
  const { session, signIn, reason } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/status';

  if (session) return <Navigate to={from} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError(t('session.required'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      await signIn({ username: username.trim(), password });
      void navigate(from, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="panel login-card" onSubmit={submit}>
        <h1>{t('app.title')}</h1>
        <p className="muted">{t('session.welcome')}</p>

        {(error || reason) && <p role="alert" className="error-message">{error || reason}</p>}

        <label htmlFor="username">{t('session.username')}</label>
        <input id="username" name="username" autoComplete="username" autoFocus
          value={username} onChange={event => setUsername(event.target.value)} />

        <label htmlFor="password">{t('session.password')}</label>
        <input id="password" name="password" type="password" autoComplete="current-password"
          value={password} onChange={event => setPassword(event.target.value)} />

        <button type="submit" className="primary full" disabled={busy}>
          <LogIn size={18} />{busy ? t('session.signingIn') : t('session.signIn')}
        </button>

        <small>{t('session.hint')}</small>
      </form>
    </div>
  );
}
