'use client';

import { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { AdminApiError } from '@/lib/admin/api';

export default function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new AdminApiError(
          response.status,
          payload?.error?.code ?? 'UNKNOWN',
          payload?.error?.message ?? 'Promena lozinke nije uspela.',
          payload?.error?.details,
        );
      }

      // Every session was revoked, including this one — so a fresh sign-in
      // is required, not optional.
      window.location.href = '/admin/login';
    } catch (caught) {
      setError(
        caught instanceof AdminApiError ? caught.message : 'Promena lozinke nije uspela.',
      );
      setPending(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl font-bold text-ts-fg mb-1">Promena lozinke</h1>

      {forced ? (
        <p className="flex items-start gap-2 text-sm text-ts-accent bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mt-4 mb-6 leading-relaxed">
          <Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5 flex-shrink-0" />
          Koristite početnu lozinku iz konfiguracije. Postavite novu da biste nastavili.
        </p>
      ) : (
        <p className="text-sm text-ts-muted mb-6">
          Nakon promene bićete odjavljeni sa svih uređaja.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="current" className="admin-label">Trenutna lozinka</label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            required
            className="admin-input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={pending}
          />
        </div>

        <div>
          <label htmlFor="next" className="admin-label">Nova lozinka</label>
          <input
            id="next"
            type="password"
            autoComplete="new-password"
            required
            className="admin-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={pending}
          />
          <p className="mt-1.5 text-xs text-ts-muted-2">
            Najmanje 12 karaktera, sa velikim i malim slovom i cifrom.
          </p>
        </div>

        <div>
          <label htmlFor="confirm" className="admin-label">Potvrda nove lozinke</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="admin-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={pending}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-[#ef6b6b]">{error}</p>
        )}

        <button type="submit" className="admin-btn admin-btn-primary w-full" disabled={pending}>
          {pending ? 'Čuvanje…' : 'Promeni lozinku'}
        </button>
      </form>
    </div>
  );
}
