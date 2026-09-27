'use client';

import { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? 'Prijava nije uspela');
        setPending(false);
        return;
      }

      // A real browser navigation, not a client-side one.
      //
      // This used to be router.replace('/admin') followed by router.refresh(),
      // which deadlocked the first login. replace() is a soft navigation — the
      // server layout does not re-run with the new cookies — so refresh() was
      // added to force it, and the two then raced: replace() moved toward
      // /admin while refresh() re-fetched the route still mounted,
      // /admin/login, whose server component now saw a valid session and
      // redirected to /admin, which redirected on to /admin/password for an
      // account that must change its password. Each hop invalidated the router
      // cache and started the next. The result was a blank screen and
      // thousands of RSC requests for /admin/login.
      //
      // assign() throws all of that client router state away: one plain
      // request for /admin, carrying the cookies, resolved entirely on the
      // server. It is what ChangePasswordForm and signOut already do, and for
      // the same reason — every auth transition has to be a full load.
      //
      // No setPending(false): the page is on its way out, and re-enabling the
      // button would only invite a second submit during the navigation.
      window.location.assign('/admin');
    } catch {
      setError('Server nije dostupan. Pokušajte ponovo.');
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2.5 mb-8">
        <span className="w-9 h-9 rounded-lg bg-ts-red flex items-center justify-center">
          <Icon name="BoltIcon" size={20} variant="solid" className="text-black" />
        </span>
        <span className="font-display text-xl font-black text-ts-fg tracking-tight">
          Teamenergo
        </span>
      </div>

      <h1 className="font-display text-2xl font-bold text-ts-fg mb-1">Administracija</h1>
      <p className="text-sm text-ts-muted mb-8">Prijavite se da biste uređivali sadržaj.</p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="admin-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            className="admin-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>

        <div>
          <label htmlFor="password" className="admin-label">
            Lozinka
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="admin-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 text-sm text-[#ef6b6b] bg-[rgba(212,41,41,0.08)] border border-[rgba(212,41,41,0.3)] rounded-lg px-3 py-2.5"
          >
            <Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5 flex-shrink-0" />
            {error}
          </p>
        )}

        <button type="submit" className="admin-btn admin-btn-primary w-full" disabled={pending}>
          {pending ? 'Prijavljivanje…' : 'Prijavi se'}
        </button>
      </form>
    </div>
  );
}
