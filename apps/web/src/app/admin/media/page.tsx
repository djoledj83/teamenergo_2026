import { readTokens } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';
import MediaLibrary, { type MediaDetail } from '@/components/admin/MediaLibrary';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Biblioteka slika' };

export default async function MediaPage() {
  const { accessToken } = await readTokens();
  const data = await apiFetch<{ items: MediaDetail[]; total: number }>(
    '/api/v1/admin/media?page=1&pageSize=24',
    { accessToken, cache: 'no-store' },
  );

  return <MediaLibrary initialItems={data.items} initialTotal={data.total} />;
}
