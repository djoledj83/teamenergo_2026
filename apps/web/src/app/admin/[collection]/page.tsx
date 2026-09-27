import { notFound } from 'next/navigation';
import { readTokens } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';
import { findCollection } from '@/lib/admin/collections';
import CollectionList from '@/components/admin/CollectionList';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ collection: string }> }) {
  const config = findCollection((await params).collection);
  return { title: config?.label ?? 'Administracija' };
}

export default async function CollectionListPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  const config = findCollection(collection);
  if (!config) notFound();

  // Fetched server-side with the access token so the first paint already has
  // data — no loading spinner on every navigation.
  const { accessToken } = await readTokens();
  const data = await apiFetch<{ items: Array<Record<string, unknown> & { id: string }> }>(
    `/api/v1/admin/${config.key}`,
    { accessToken, cache: 'no-store' },
  );

  return <CollectionList collection={config} initialItems={data.items} />;
}
