'use client';

import { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';

/**
 * Who changed what.
 *
 * Read-only, with no controls that alter anything — the value of a change
 * history is that it cannot be tidied up after the fact.
 *
 * A row's diff is shown as from → to per field rather than the whole record,
 * because "summary changed" is the question being asked, not "here is the
 * entity again".
 */

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  diff: unknown;
  ip: string | null;
  createdAt: string;
  adminUser: { id: string; name: string; email: string } | null;
}

export interface AuditFacets {
  entities: string[];
  actions: string[];
  users: Array<{ id: string; name: string; email: string }>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** `{ field: { from, to } }` is what diffOf() writes; anything else is shown raw. */
function asFieldDiff(diff: unknown): Array<[string, { from: unknown; to: unknown }]> | null {
  if (!diff || typeof diff !== 'object' || Array.isArray(diff)) return null;
  const entries = Object.entries(diff as Record<string, unknown>);
  const shaped = entries.every(
    ([, value]) =>
      value !== null && typeof value === 'object' && 'from' in value && 'to' in value,
  );
  return shaped ? (entries as Array<[string, { from: unknown; to: unknown }]>) : null;
}

function preview(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  return JSON.stringify(value);
}

export default function AuditLog({
  initialItems,
  initialTotal,
  facets,
}: {
  initialItems: AuditEntry[];
  initialTotal: number;
  facets: AuditFacets;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const load = async (nextPage: number, nextEntity: string, nextAction: string) => {
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (nextEntity) query.set('entity', nextEntity);
      if (nextAction) query.set('action', nextAction);
      const data = await adminApi.get<{ items: AuditEntry[]; total: number }>(
        `audit?${query.toString()}`,
      );
      setItems(data.items);
      setTotal(data.total);
      setPage(nextPage);
      setEntity(nextEntity);
      setAction(nextAction);
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Učitavanje nije uspelo.');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="admin-title">Istorija izmena</h1>
        <p className="admin-subtitle">{total} zapisa · najnoviji prvi</p>
      </header>

      {(facets.entities.length > 0 || facets.actions.length > 0) && (
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs text-ts-muted">Entitet</span>
            <select
              className="admin-select w-auto"
              value={entity}
              onChange={(e) => load(1, e.target.value, action)}>
              <option value="">Svi</option>
              {facets.entities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-xs text-ts-muted">Akcija</span>
            <select
              className="admin-select w-auto"
              value={action}
              onChange={(e) => load(1, entity, e.target.value)}>
              <option value="">Sve</option>
              {facets.actions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <Icon name="ClockIcon" size={32} className="text-ts-muted-2 mx-auto mb-3" />
          <p className="text-ts-muted">Nema zapisa.</p>
        </div>
      ) : (
        <ul className="admin-card divide-y divide-ts-border">
          {items.map((entry) => {
            const fields = asFieldDiff(entry.diff);
            const expandable = entry.diff !== null && entry.diff !== undefined;
            const open = openId === entry.id;

            return (
              <li key={entry.id}>
                <div className="flex items-center gap-4 p-3 text-sm">
                  <span className="text-xs text-ts-muted font-mono flex-shrink-0 hidden sm:block">
                    {formatDate(entry.createdAt)}
                  </span>
                  <span className="font-mono text-xs px-2 py-1 rounded bg-ts-surface-2 text-ts-blue flex-shrink-0">
                    {entry.action}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ts-muted">
                    {entry.adminUser?.name ?? 'sistem'}
                    {entry.entityId ? ` · ${entry.entityId}` : ''}
                  </span>
                  {expandable && (
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : entry.id)}
                      aria-expanded={open}
                      aria-label="Detalji"
                      className="p-1.5 rounded text-ts-muted hover:text-ts-fg flex-shrink-0">
                      <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} />
                    </button>
                  )}
                </div>

                {open && (
                  <div className="px-3 pb-4">
                    {fields ? (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-ts-muted text-left">
                            <th className="py-1 pr-4 font-medium">Polje</th>
                            <th className="py-1 pr-4 font-medium">Pre</th>
                            <th className="py-1 font-medium">Posle</th>
                          </tr>
                        </thead>
                        <tbody className="align-top">
                          {fields.map(([field, change]) => (
                            <tr key={field} className="border-t border-ts-border">
                              <td className="py-1.5 pr-4 font-mono text-ts-fg">{field}</td>
                              <td className="py-1.5 pr-4 text-ts-muted break-words">
                                {preview(change.from)}
                              </td>
                              <td className="py-1.5 text-ts-fg break-words">
                                {preview(change.to)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <pre className="text-xs text-ts-muted bg-ts-bg rounded-lg p-3 overflow-auto">
                        {JSON.stringify(entry.diff, null, 2)}
                      </pre>
                    )}
                    {entry.ip && <p className="text-[11px] text-ts-muted mt-2">IP: {entry.ip}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={page <= 1}
            onClick={() => load(page - 1, entity, action)}>
            Prethodna
          </button>
          <span className="text-sm text-ts-muted">
            {page} / {pages}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={page >= pages}
            onClick={() => load(page + 1, entity, action)}>
            Sledeća
          </button>
        </div>
      )}
    </div>
  );
}
