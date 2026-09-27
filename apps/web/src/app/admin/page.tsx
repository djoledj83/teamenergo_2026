import Link from 'next/link';
import { readTokens } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';
import Icon from '@/components/ui/AppIcon';
import { ADMIN_COLLECTIONS } from '@/lib/admin/collections';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Pregled' };

interface Dashboard {
  counts: {
    services: number;
    projects: number;
    posts: number;
    team: number;
    albums: number;
    media: number;
    newInquiries: number;
  };
  recentInquiries: Array<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    status: string;
    createdAt: string;
  }>;
}

const TILES: Array<{ key: keyof Dashboard['counts']; label: string; href: string; icon: string }> = [
  { key: 'services', label: 'Usluge', href: '/admin/services', icon: 'WrenchScrewdriverIcon' },
  { key: 'projects', label: 'Reference', href: '/admin/projects', icon: 'BuildingOffice2Icon' },
  { key: 'posts', label: 'Vesti', href: '/admin/posts', icon: 'NewspaperIcon' },
  { key: 'team', label: 'Tim', href: '/admin/team', icon: 'UsersIcon' },
  { key: 'albums', label: 'Albumi', href: '/admin/gallery', icon: 'PhotoIcon' },
  { key: 'media', label: 'Slike', href: '/admin/media', icon: 'RectangleStackIcon' },
];

export default async function AdminDashboard() {
  const { accessToken } = await readTokens();
  const data = await apiFetch<Dashboard>('/api/v1/admin/dashboard', {
    accessToken,
    cache: 'no-store',
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ts-fg">Pregled</h1>
        <p className="text-sm text-ts-muted mt-0.5">Stanje sadržaja na sajtu.</p>
      </div>

      {data.counts.newInquiries > 0 && (
        <Link
          href="/admin/inquiries"
          className="flex items-center gap-3 admin-card px-5 py-4 hover:border-ts-blue transition-colors"
        >
          <span className="w-10 h-10 rounded-xl bg-ts-blue/15 flex items-center justify-center flex-shrink-0">
            <Icon name="InboxArrowDownIcon" size={19} className="text-ts-blue" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ts-fg">
              {data.counts.newInquiries}{' '}
              {data.counts.newInquiries === 1 ? 'nov upit' : 'novih upita'}
            </p>
            <p className="text-xs text-ts-muted">Pogledajte poruke sa kontakt forme.</p>
          </div>
          <Icon name="ChevronRightIcon" size={16} className="ml-auto text-ts-muted" />
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {TILES.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            className="admin-card p-4 hover:border-ts-muted-2 transition-colors"
          >
            <Icon name={tile.icon} size={18} className="text-ts-muted mb-3" />
            <p className="font-display text-2xl font-black text-ts-fg tabular-nums">
              {data.counts[tile.key]}
            </p>
            <p className="text-xs text-ts-muted font-medium mt-0.5">{tile.label}</p>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ts-muted-2">
          Poslednji upiti
        </h2>

        {data.recentInquiries.length === 0 ? (
          <div className="admin-card py-10 text-center">
            <p className="text-sm text-ts-muted">Još nema upita sa kontakt forme.</p>
          </div>
        ) : (
          <div className="admin-card divide-y divide-ts-border overflow-hidden">
            {data.recentInquiries.map((inquiry) => (
              <Link
                key={inquiry.id}
                href={`/admin/inquiries/${inquiry.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-ts-surface-2/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ts-fg truncate">
                    {inquiry.name}
                    {inquiry.company && (
                      <span className="text-ts-muted font-normal"> · {inquiry.company}</span>
                    )}
                  </p>
                  <p className="text-xs text-ts-muted truncate">{inquiry.email}</p>
                </div>
                {inquiry.status === 'NEW' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-ts-blue/15 text-ts-blue flex-shrink-0">
                    Novo
                  </span>
                )}
                <time
                  dateTime={inquiry.createdAt}
                  className="text-xs text-ts-muted-2 flex-shrink-0 tabular-nums"
                >
                  {new Date(inquiry.createdAt).toLocaleDateString('sr-RS')}
                </time>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ts-muted-2">Prečice</h2>
        <div className="flex flex-wrap gap-2">
          {ADMIN_COLLECTIONS.filter((collection) => !collection.hidden).map((collection) => (
            <Link
              key={collection.key}
              href={`/admin/${collection.key}/new`}
              className="admin-btn admin-btn-ghost"
            >
              <Icon name="PlusIcon" size={14} />
              {collection.labelSingular}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
