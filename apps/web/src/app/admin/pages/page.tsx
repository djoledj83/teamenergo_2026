import Link from 'next/link';
import { readTokens } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';
import Icon from '@/components/ui/AppIcon';
import { pagePath } from '@/lib/admin/pages';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Stranice' };

interface PageRow {
  key: string;
  translations: Array<{ locale: string; title: string }>;
  blocks: Array<{ id: string; blockKey: string }>;
}

/**
 * Pages are fixed — one row per section of the site, created by the seed.
 * They are not a collection you add to, because a new page here would have
 * no route to render it. What is editable is the copy: the page's own title
 * and SEO fields, and the blocks inside it.
 */
export default async function PagesIndex() {
  const { accessToken } = await readTokens();
  const { items } = await apiFetch<{ items: PageRow[] }>('/api/v1/admin/site/pages', {
    accessToken,
    cache: 'no-store',
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="admin-title">Stranice</h1>
          <p className="admin-subtitle">
            Tekst koji se pojavljuje na stranicama sajta — naslovi, uvodni blokovi i SEO.
          </p>
        </div>
      </header>

      <div className="admin-card divide-y divide-ts-border">
        {items.map((page) => {
          const sr = page.translations.find((t) => t.locale === 'sr');
          return (
            <Link
              key={page.key}
              href={`/admin/pages/${page.key}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-ts-surface-2 transition-colors">
              <div className="min-w-0">
                <p className="font-semibold text-ts-fg truncate">{sr?.title ?? page.key}</p>
                <p className="text-xs text-ts-muted mt-0.5">
                  {pagePath(page.key) ?? `bez stranice (${page.key})`} · {page.blocks.length}{' '}
                  {page.blocks.length === 1 ? 'blok' : 'blokova'}
                </p>
              </div>
              <Icon name="ChevronRightIcon" size={16} className="text-ts-muted flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
