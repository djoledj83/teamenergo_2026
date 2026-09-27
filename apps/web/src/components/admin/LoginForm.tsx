'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

export default function LoginForm() {
  const router = useRouter();
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

      // A full navigation rather than a client push, so the server layout
      // re-runs and picks up the new session cookie.
      router.replace('/admin');
      router.refresh();
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
