import { notFound } from 'next/navigation';
import { readTokens } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';
import { findCollection } from '@/lib/admin/collections';
import CollectionForm from '@/components/admin/CollectionForm';
import AlbumItemsEditor, { type AlbumItem } from '@/components/admin/AlbumItemsEditor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = await params;
  const config = findCollection(collection);
  if (!config) return { title: 'Administracija' };
  return { title: id === 'new' ? `Novi — ${config.labelSingular}` : config.labelSingular };
}

export default async function CollectionEditPage({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = await params;
  const config = findCollection(collection);
  if (!config) notFound();

  // "new" is a reserved id rather than a separate route, so the create and
  // edit screens stay one component.
  if (id === 'new') {
    return (
      <div className="space-y-6">
        <CollectionForm collection={config} entity={null} />
        {config.key === 'gallery' && (
          // Photos attach to an album id, which does not exist yet. Saying so
          // beats an empty panel that silently rejects everything dropped on
          // it.
          <p className="admin-card p-5 text-sm text-ts-muted">
            Sačuvajte album da biste mu dodali fotografije.
          </p>
        )}
      </div>
    );
  }

  const { accessToken } = await readTokens();

  try {
    const entity = await apiFetch<Record<string, unknown>>(
      `/api/v1/admin/${config.key}/${id}`,
      { accessToken, cache: 'no-store' },
    );

    return (
      <div className="space-y-6">
        <CollectionForm collection={config} entity={entity} />
        {/* An album's photos are a list of their own, saved per change rather
            than with the form — and a <form> cannot be nested inside another,
            which is why this is a sibling and not a field. */}
        {config.key === 'gallery' && (
          <AlbumItemsEditor
            albumId={id}
            initialItems={(entity.items as AlbumItem[] | undefined) ?? []}
            coverImageId={(entity.coverImageId as string | null | undefined) ?? null}
          />
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }
}
