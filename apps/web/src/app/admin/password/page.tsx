import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import ChangePasswordForm from '@/components/admin/ChangePasswordForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Promena lozinke' };

export default async function PasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');

  return <ChangePasswordForm forced={user.mustChangePassword} />;
}
