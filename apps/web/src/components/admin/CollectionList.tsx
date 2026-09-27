'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { DEFAULT_LOCALE, type ReorderInput } from '@teamenergo/shared';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import type { AdminCollection, ColumnConfig } from '@/lib/admin/collections';
import { mediaSrc } from '@/lib/admin/media';

/**
 * The list screen for every collection, generated from its config.
 *
 * Reordering is optimistic: rows move immediately and revert if the request
 * fails, because waiting for a round trip per nudge makes ordering a chore.
 */

type Row = Record<string, unknown> & { id: string };

interface Props {
  collection: AdminCollection;
  initialItems: Row[];
}

/** Reads a column value, resolving translated columns to the default locale. */
function cellValue(row: Row, column: ColumnConfig): unknown {
  if (!column.translated) return row[column.key];
  const translations = (row.translations as Array<Record<string, unknown>> | undefined) ?? [];
  const match =
    translations.find((t) => t.locale === DEFAULT_LOCALE) ?? translations[0];
  return match?.[column.key];
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CollectionList({ collection, initialItems }: Props) {
  const [items, setItems] = useState<Row[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const previous = items;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setItems(next);
    setBusy(true);
    setError(null);

    try {
      const payload: ReorderInput = { ids: next.map((row) => row.id) };
      await adminApi.post(`${collection.key}/reorder`, payload);
    } catch (caught) {
      // Put the list back where it was rather than leaving the screen
      // showing an order the database does not have.
      setItems(previous);
      setError(caught instanceof AdminApiError ? caught.message : 'Promena redosleda nije uspela.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ts-fg">{collection.label}</h1>
          <p className="text-sm text-ts-muted mt-0.5">
            {items.length} {items.length === 1 ? 'unos' : 'unosa'}
          </p>
        </div>
        <Link href={`/admin/${collection.key}/new`} className="admin-btn admin-btn-primary">
          <Icon name="PlusIcon" size={15} />
          Novi unos
        </Link>
      </div>

      {collection.emptyHint && (
        <p className="flex items-start gap-2 text-xs text-ts-muted bg-ts-surface border border-ts-border rounded-lg px-4 py-3 leading-relaxed">
          <Icon name="InformationCircleIcon" size={15} className="mt-0.5 flex-shrink-0 text-ts-accent" />
          {collection.emptyHint}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-[#ef6b6b]">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="admin-card py-16 text-center">
          <Icon name={collection.icon} size={30} className="mx-auto text-ts-muted-2 mb-3" />
          <p className="text-sm text-ts-muted">Još nema unosa.</p>
          <Link
            href={`/admin/${collection.key}/new`}
            className="admin-btn admin-btn-ghost mt-4 inline-flex"
          >
            Dodaj prvi
          </Link>
        </div>
      ) : (
        <div className="admin-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ts-border">
                {collection.sortable && <th className="w-16" />}
                {collection.columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ts-muted-2"
                  >
                    {column.label}
                  </th>
                ))}
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-ts-border last:border-0 hover:bg-ts-surface-2/40 transition-colors"
                >
                  {collection.sortable && (
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className="p-0.5 text-ts-muted-2 hover:text-ts-fg disabled:opacity-30"
                          onClick={() => void move(index, -1)}
                          disabled={busy || index === 0}
                          aria-label="Pomeri gore"
                        >
                          <Icon name="ChevronUpIcon" size={14} />
                        </button>
                        <button
                          type="button"
                          className="p-0.5 text-ts-muted-2 hover:text-ts-fg disabled:opacity-30"
                          onClick={() => void move(index, 1)}
                          disabled={busy || index === items.length - 1}
                          aria-label="Pomeri dole"
                        >
                          <Icon name="ChevronDownIcon" size={14} />
                        </button>
                      </div>
                    </td>
                  )}

                  {collection.columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 align-middle">
                      <Cell row={row} column={column} />
                    </td>
                  ))}

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <MissingLocaleBadge row={row} />
                      <Link
                        href={`/admin/${collection.key}/${row.id}`}
                        className="text-ts-muted hover:text-ts-fg transition-colors"
                        aria-label="Uredi"
                      >
                        <Icon name="PencilSquareIcon" size={17} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cell({ row, column }: { row: Row; column: ColumnConfig }) {
  const value = cellValue(row, column);

  switch (column.type) {
    case 'image': {
      const media = value as { path?: string } | null;
      return media?.path ? (
        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-ts-border">
          <Image src={mediaSrc(media.path)} alt="" fill sizes="40px" className="object-cover" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-lg border border-ts-border bg-ts-surface-2 flex items-center justify-center text-ts-muted-2">
          <Icon name="PhotoIcon" size={15} />
        </div>
      );
    }

    case 'boolean':
      return value ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4ade80]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
          Objavljeno
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ts-muted-2">
          <span className="w-1.5 h-1.5 rounded-full bg-ts-muted-2" />
          Nacrt
        </span>
      );

    case 'badge':
      return value ? (
        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-ts-surface-2 text-ts-muted">
          {String(value)}
        </span>
      ) : (
        <span className="text-ts-muted-2">—</span>
      );

    case 'date':
      return <span className="text-ts-muted text-xs">{formatDate(value)}</span>;

    case 'number':
      return <span className="text-ts-muted tabular-nums">{value == null ? '—' : String(value)}</span>;

    default:
      return value ? (
        <span className="text-ts-fg font-medium">{String(value)}</span>
      ) : (
        <span className="text-ts-muted-2">—</span>
      );
  }
}

/** Shows which languages are still missing, straight from the API's list payload. */
function MissingLocaleBadge({ row }: { row: Row }) {
  const missing = (row.missingLocales as string[] | undefined) ?? [];
  if (missing.length === 0) return null;

  return (
    <span
      title={`Nedostaje prevod: ${missing.join(', ').toUpperCase()}`}
      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-ts-accent"
    >
      {missing.join('/')}
    </span>
  );
}
