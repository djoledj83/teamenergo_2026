import { readTokens } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';
import SettingsForm from '@/components/admin/SettingsForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Podešavanja' };

export default async function SettingsPage() {
  const { accessToken } = await readTokens();
  const { items } = await apiFetch<{ items: Record<string, unknown> }>(
    '/api/v1/admin/site/settings',
    { accessToken, cache: 'no-store' },
  );

  return <SettingsForm initial={items} />;
}
