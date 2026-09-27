import { readTokens } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';
import NavigationEditor, { type NavItem } from '@/components/admin/NavigationEditor';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Navigacija' };

export default async function NavigationPage() {
  const { accessToken } = await readTokens();
  const { items } = await apiFetch<{ items: NavItem[] }>('/api/v1/admin/site/nav', {
    accessToken,
    cache: 'no-store',
  });

  return <NavigationEditor items={items} />;
}
