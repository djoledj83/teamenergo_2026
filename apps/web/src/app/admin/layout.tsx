import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/session';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  title: { default: 'Administracija', template: '%s · Teamenergo' },
  // The admin panel must never appear in search results.
  robots: { index: false, follow: false },
};

// Auth state is per-request; nothing here may be statically cached.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '';

  // The login and password screens render inside this layout but outside the
  // guard, otherwise signing in would redirect to itself forever.
  const isPublicRoute = pathname.includes('/admin/login');
  if (isPublicRoute) return <>{children}</>;

  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');

  // A forced password change blocks every other screen, so a seeded initial
  // credential cannot be used to do real work.
  if (user.mustChangePassword && !pathname.includes('/admin/password')) {
    redirect('/admin/password');
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
