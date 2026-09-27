import { readTokens, getCurrentUser } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';
import AuditLog, { type AuditEntry, type AuditFacets } from '@/components/admin/AuditLog';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Istorija izmena' };

export default async function AuditPage() {
  const user = await getCurrentUser();

  // The API restricts this to owners; saying so here is clearer than letting
  // the fetch fail with a 403 the screen would have to interpret.
  if (user?.role !== 'OWNER') {
    return (
      <div className="admin-card p-8">
        <h1 className="admin-title">Istorija izmena</h1>
        <p className="admin-subtitle">
          Ovoj stranici mogu pristupiti samo vlasnici naloga.
        </p>
      </div>
    );
  }

  const { accessToken } = await readTokens();
  const [data, facets] = await Promise.all([
    apiFetch<{ items: AuditEntry[]; total: number }>('/api/v1/admin/audit?page=1&pageSize=50', {
      accessToken,
      cache: 'no-store',
    }),
    apiFetch<AuditFacets>('/api/v1/admin/audit/facets', { accessToken, cache: 'no-store' }).catch(
      (error: unknown) => {
        // Filters are a convenience; the log itself still renders without them.
        if (error instanceof ApiError) return { entities: [], actions: [], users: [] };
        throw error;
      },
    ),
  ]);

  return <AuditLog initialItems={data.items} initialTotal={data.total} facets={facets} />;
}
