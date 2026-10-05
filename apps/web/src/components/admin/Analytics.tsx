'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

/**
 * The Analitika screen.
 *
 * Charts drawn by hand in SVG rather than with a charting library. Four bar
 * charts and a handful of lists do not justify a hundred kilobytes in the
 * admin bundle, and a library's defaults would have to be fought back into
 * this design system anyway.
 *
 * Everything on this screen counts VIEWS. Nothing identifies a visitor —
 * there is no cookie and no stored address — so the same person reading three
 * pages is three views, and the screen says so rather than printing a
 * "visitors" number that would be a guess.
 */

export interface AnalyticsData {
  range: { days: number; from: string; to: string };
  totals: Record<'views' | 'downloads' | 'inquiries', { value: number; previous: number }>;
  series: Record<'views' | 'inquiries', Array<{ day: string; count: number }>>;
  pages: Entry[];
  referrers: Entry[];
  locales: Entry[];
  devices: Entry[];
  countries: Entry[];
  downloads: Entry[];
  articles: Entry[];
  inquiriesByService: Entry[];
}

interface Entry {
  key: string;
  label?: string | null;
  count: number;
}

const RANGES = [7, 30, 90];

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobilni',
  tablet: 'Tablet',
  desktop: 'Računar',
};

const LOCALE_LABELS: Record<string, string> = { sr: 'Srpski', en: 'Engleski' };

export default function Analytics({ data }: { data: AnalyticsData }) {
  const router = useRouter();
  const params = useSearchParams();
  const days = Number(params.get('days')) || data.range.days;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="admin-title">Analitika</h1>
          <p className="admin-subtitle">
            Pregledi stranica, preuzimanja dokumenata i upiti. Broje se pregledi, ne
            posetioci — sajt ne postavlja kolačiće i ne čuva adrese, pa se isti čitalac
            ne može prepoznati pri sledećoj poseti.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-ts-border bg-ts-surface p-1">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => router.push(`/admin/analytics?days=${value}`)}
              aria-pressed={value === days}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                value === days ? 'bg-ts-red text-black' : 'text-ts-muted hover:text-ts-fg'
              }`}>
              {value} dana
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Total label="Pregledi stranica" {...data.totals.views} icon="EyeIcon" />
        <Total label="Preuzimanja" {...data.totals.downloads} icon="ArrowDownTrayIcon" />
        <Total label="Upiti" {...data.totals.inquiries} icon="InboxIcon" />
      </div>

      <Bars title="Pregledi po danu" series={data.series.views} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <List title="Najposećenije stranice" entries={data.pages} empty="Još nema pregleda." />
        <List
          title="Odakle dolaze"
          entries={data.referrers}
          empty="Nema zabeleženih izvora — posete su stigle direktno."
          note="Beleži se samo domen sajta sa kog je posetilac došao, nikada ceo link."
        />
        <List title="Preuzeti dokumenti" entries={data.downloads} empty="Još nema preuzimanja." />
        <List title="Najčitanije vesti" entries={data.articles} empty="Još nema pregleda vesti." />
        <List
          title="Odakle su posetioci"
          entries={data.countries}
          empty="Još nema podataka o zemljama."
          note="Zemlja se određuje iz adrese posetioca na ovom serveru; sama adresa se ne čuva."
        />

        {/* Language and device share one column. Both are two or three rows
            at most, and on their own each would be a card of mostly empty
            space beside a list of eight countries. */}
        <div className="space-y-6">
          <List
            title="Jezik"
            entries={data.locales.map((e) => ({ ...e, label: LOCALE_LABELS[e.key] ?? e.key }))}
            empty="—"
          />
          <List
            title="Uređaj"
            entries={data.devices.map((e) => ({ ...e, label: DEVICE_LABELS[e.key] ?? e.key }))}
            empty="—"
          />
        </div>
      </div>

      <Bars title="Upiti po danu" series={data.series.inquiries} />
      <List
        title="Upiti po usluzi"
        entries={data.inquiriesByService}
        empty="Još nema upita u ovom periodu."
      />

      {/* DB-IP's Lite database is CC-BY: free to use, with a credit where its
          results are shown. This is that credit, and the honest place for it
          is beside the numbers it produced. */}
      <p className="text-xs text-ts-muted-2">
        Podaci o zemljama:{' '}
        <a
          href="https://db-ip.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ts-muted transition-colors">
          IP Geolocation by DB-IP
        </a>{' '}
        (CC BY 4.0)
      </p>
    </div>
  );
}

function Total({
  label,
  value,
  previous,
  icon,
}: {
  label: string;
  value: number;
  previous: number;
  icon: string;
}) {
  // No percentage against zero: "+100%" from one view to two is noise, and
  // from nothing to something it is not a percentage at all.
  const change = previous > 0 ? Math.round(((value - previous) / previous) * 100) : null;

  return (
    <div className="admin-card p-5">
      <div className="flex items-center gap-2 text-ts-muted">
        <Icon name={icon} size={15} className="text-ts-red" />
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-display text-3xl font-black text-ts-fg mt-2">
        {value.toLocaleString('sr-RS')}
      </p>
      <p className="text-xs text-ts-muted mt-1">
        {change === null
          ? `prethodni period: ${previous.toLocaleString('sr-RS')}`
          : `${change >= 0 ? '+' : ''}${change}% u odnosu na prethodni period`}
      </p>
    </div>
  );
}

/**
 * A bar per day.
 *
 * Scaled to the busiest day in the range, with a floor of 1 so a period with
 * no traffic draws a flat baseline rather than dividing by zero. Every day in
 * the range is present, zeros included — a chart of only the days that had
 * traffic would draw a quiet month exactly like a busy one.
 */
function Bars({ title, series }: { title: string; series: Array<{ day: string; count: number }> }) {
  const peak = Math.max(1, ...series.map((point) => point.count));
  const total = series.reduce((sum, point) => sum + point.count, 0);

  return (
    <section className="admin-card p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-semibold text-ts-fg">{title}</h2>
        <span className="text-xs text-ts-muted">najviše u jednom danu: {peak}</span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-ts-muted">Nema podataka za izabrani period.</p>
      ) : (
        <div className="flex items-end gap-[2px] h-40" role="img"
          aria-label={`${title}: ${total} ukupno, najviše ${peak} u jednom danu`}>
          {series.map((point) => (
            <div
              key={point.day}
              title={`${formatDay(point.day)}: ${point.count}`}
              className="flex-1 min-w-[2px] bg-ts-red/70 hover:bg-ts-red transition-colors rounded-t-sm"
              // A day with no traffic still draws a sliver, so the axis reads
              // as a row of days rather than as gaps in the chart.
              style={{ height: `${Math.max(2, (point.count / peak) * 100)}%` }}
            />
          ))}
        </div>
      )}

      {series.length > 0 && (
        <div className="flex justify-between text-[11px] text-ts-muted">
          <span>{formatDay(series[0]!.day)}</span>
          <span>{formatDay(series[series.length - 1]!.day)}</span>
        </div>
      )}
    </section>
  );
}

function List({
  title,
  entries,
  empty,
  note,
}: {
  title: string;
  entries: Entry[];
  empty: string;
  note?: string;
}) {
  const peak = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    <section className="admin-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-ts-fg">{title}</h2>
        {note && <p className="text-xs text-ts-muted mt-0.5">{note}</p>}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-ts-muted">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {entries.map((entry) => (
            <li key={entry.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-ts-fg truncate" title={entry.label ?? entry.key}>
                  {entry.label ?? entry.key}
                </span>
                <span className="text-ts-muted tabular-nums flex-shrink-0">{entry.count}</span>
              </div>
              {/* The bar is the comparison; the number is the fact. Reading
                  a list of numbers for the shape is work a reader should
                  not have to do. */}
              <div className="h-1 rounded-full bg-ts-border overflow-hidden">
                <div
                  className="h-full bg-ts-red/60 rounded-full"
                  style={{ width: `${(entry.count / peak) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDay(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(day)}.${Number(month)}.`;
}
