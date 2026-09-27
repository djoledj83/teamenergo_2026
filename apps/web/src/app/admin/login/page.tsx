import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import LoginForm from '@/components/admin/LoginForm';

export const metadata: Metadata = {
  title: 'Prijava',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Already signed in — no reason to show the form again.
  const user = await getCurrentUser();
  if (user) redirect('/admin');

  return (
    <div className="admin-shell flex items-center justify-center px-5 py-16">
      <LoginForm />
    </div>
  );
}
