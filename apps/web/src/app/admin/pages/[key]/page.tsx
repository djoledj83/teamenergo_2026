import { notFound } from 'next/navigation';
import { readTokens } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';
import PageEditor, { type PageData } from '@/components/admin/PageEditor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  return { title: `Stranica — ${(await params).key}` };
}

export default async function EditPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { accessToken } = await readTokens();

  const page = await apiFetch<PageData>(`/api/v1/admin/site/pages/${key}`, {
    accessToken,
    cache: 'no-store',
  }).catch((error: unknown) => {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  });

  if (!page) notFound();

  return <PageEditor page={page} />;
}
