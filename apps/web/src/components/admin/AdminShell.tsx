'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthenticatedUser } from '@teamenergo/shared';
import Icon from '@/components/ui/AppIcon';
import { ADMIN_COLLECTIONS, NAV_GROUPS } from '@/lib/admin/collections';
import { signOut } from '@/lib/admin/api';

/**
 * Admin chrome: sidebar, mobile drawer, and the signed-in user menu.
 *
 * The sidebar is generated from the collection config, so a new content type
 * appears here automatically.
 */

interface NavLink {
  href: string;
  label: string;
  icon: string;
  group: 'content' | 'site' | 'system';
}

const FIXED_LINKS: NavLink[] = [
  { href: '/admin/media', label: 'Biblioteka slika', icon: 'PhotoIcon', group: 'site' },
  { href: '/admin/pages', label: 'Stranice', icon: 'DocumentTextIcon', group: 'site' },
  { href: '/admin/navigation', label: 'Navigacija', icon: 'Bars3Icon', group: 'site' },
  { href: '/admin/settings', label: 'Podešavanja', icon: 'Cog6ToothIcon', group: 'site' },
  { href: '/admin/analytics', label: 'Analitika', icon: 'ChartBarIcon', group: 'system' },
  { href: '/admin/inquiries', label: 'Upiti', icon: 'InboxIcon', group: 'system' },
  { href: '/admin/audit', label: 'Istorija izmena', icon: 'ClockIcon', group: 'system' },
];

export default function AdminShell({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const links: NavLink[] = [
    ...ADMIN_COLLECTIONS.filter((collection) => !collection.hidden).map((collection) => ({
      href: `/admin/${collection.key}`,
      label: collection.label,
      icon: collection.icon,
      group: collection.group,
    })),
    ...FIXED_LINKS.filter((link) => link.href !== '/admin/audit' || user.role === 'OWNER'),
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));

  const sidebar = (
    <nav className="flex flex-col gap-6 p-5">
      <Link
        href="/admin"
        className="flex items-center gap-2.5 px-2"
        onClick={() => setDrawerOpen(false)}
      >
        {/* The company mark, not a stand-in icon — the same rounded logo the
            browser tab shows, so the admin looks like part of the site. */}
        <Image
          src="/assets/images/favicon.png"
          alt=""
          width={32}
          height={32}
          className="w-8 h-8 rounded-full flex-shrink-0"
          priority
        />
        <span className="font-display font-black text-ts-fg tracking-tight">Teamenergo</span>
      </Link>

      <Link
        href="/admin"
        onClick={() => setDrawerOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          pathname === '/admin'
            ? 'bg-ts-surface-2 text-ts-fg'
            : 'text-ts-muted hover:text-ts-fg hover:bg-ts-surface-2/60'
        }`}
      >
        <Icon name="Squares2X2Icon" size={17} />
        Pregled
      </Link>

      {NAV_GROUPS.map((group) => {
        const groupLinks = links.filter((link) => link.group === group.key);
        if (groupLinks.length === 0) return null;

        return (
          <div key={group.key} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-ts-muted-2">
              {group.label}
            </p>
            {groupLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setDrawerOpen(false)}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-ts-surface-2 text-ts-fg'
                    : 'text-ts-muted hover:text-ts-fg hover:bg-ts-surface-2/60'
                }`}
              >
                <Icon name={link.icon} size={17} />
                {link.label}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="admin-shell flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 border-r border-ts-border min-h-screen sticky top-0 overflow-y-auto">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Zatvori meni"
            className="lg:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-64 bg-ts-bg border-r border-ts-border z-50 overflow-y-auto">
            {sidebar}
          </aside>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-5 h-16 border-b border-ts-border bg-ts-bg/95 backdrop-blur-xl">
          <button
            type="button"
            className="lg:hidden p-2 -ml-2 text-ts-muted hover:text-ts-fg"
            onClick={() => setDrawerOpen(true)}
            aria-label="Otvori meni"
          >
            <Icon name="Bars3Icon" size={22} />
          </button>

          <div className="flex-1" />

          <Link
            href="/"
            target="_blank"
            className="hidden sm:flex items-center gap-2 text-xs font-semibold text-ts-muted hover:text-ts-fg transition-colors"
          >
            <Icon name="ArrowTopRightOnSquareIcon" size={15} />
            Pogledaj sajt
          </Link>

          <UserMenu user={user} />
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1400px] w-full">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ user }: { user: AuthenticatedUser }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full border border-ts-border hover:border-ts-muted-2 transition-colors"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="w-7 h-7 rounded-full bg-ts-surface-2 flex items-center justify-center text-xs font-bold text-ts-fg">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:block text-xs font-semibold text-ts-muted max-w-[10rem] truncate">
          {user.name}
        </span>
        <Icon name="ChevronDownIcon" size={14} className="text-ts-muted" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Zatvori"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 admin-card p-1.5 z-40 shadow-2xl"
          >
            <div className="px-3 py-2 border-b border-ts-border mb-1">
              <p className="text-sm font-semibold text-ts-fg truncate">{user.name}</p>
              <p className="text-xs text-ts-muted truncate">{user.email}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ts-muted-2 mt-1">
                {user.role === 'OWNER' ? 'Vlasnik' : 'Urednik'}
              </p>
            </div>
            <Link
              href="/admin/password"
              role="menuitem"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ts-muted hover:text-ts-fg hover:bg-ts-surface-2 transition-colors"
              onClick={() => setOpen(false)}
            >
              <Icon name="KeyIcon" size={16} />
              Promeni lozinku
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ts-muted hover:text-ts-fg hover:bg-ts-surface-2 transition-colors"
            >
              <Icon name="ArrowRightOnRectangleIcon" size={16} />
              Odjavi se
            </button>
          </div>
        </>
      )}
    </div>
  );
}
