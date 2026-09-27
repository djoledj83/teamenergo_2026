import { readTokens } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';
import InquiriesInbox, { type Inquiry } from '@/components/admin/InquiriesInbox';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Upiti' };

export default async function InquiriesPage() {
  const { accessToken } = await readTokens();
  const data = await apiFetch<{ items: Inquiry[]; total: number; newCount: number }>(
    '/api/v1/admin/inquiries?page=1&pageSize=20',
    { accessToken, cache: 'no-store' },
  );

  return (
    <InquiriesInbox
      initialItems={data.items}
      initialTotal={data.total}
      initialNewCount={data.newCount}
    />
  );
}
