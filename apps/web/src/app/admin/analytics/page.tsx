import { readTokens } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/client';
import Analytics, { type AnalyticsData } from '@/components/admin/Analytics';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Analitika' };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  const { accessToken } = await readTokens();

  // The API clamps `days` to the three the screen offers, so a hand-edited
  // query string gives the default view rather than an error.
  const data = await apiFetch<AnalyticsData>(
    `/api/v1/admin/analytics?days=${encodeURIComponent(days ?? '30')}`,
    { accessToken, cache: 'no-store' },
  );

  return <Analytics data={data} />;
}
