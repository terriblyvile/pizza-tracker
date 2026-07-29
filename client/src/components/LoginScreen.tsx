import { useState, type FormEvent } from 'react';

import { api } from '../api';

interface LoginScreenProps {
  /** True when no password has been set on the server yet. */
  setupRequired: boolean;
  onSignedIn: () => void;
}

export function LoginScreen({ setupRequired, onSignedIn }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) return;

    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      setPassword('');
      onSignedIn();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Could not sign in.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            🍕
          </span>
          <h1>Pizza Tracker</h1>
        </div>

        {setupRequired ? (
          <>
            <p className="muted">No password has been set yet. On the machine running the app:</p>
            <pre className="login-code">npm run set-password</pre>
            <p className="muted small">Then restart the server and reload this page.</p>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </div>

            {error && <p className="notice notice-error">{error}</p>}

            <button className="btn btn-primary login-submit" type="submit" disabled={busy || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
