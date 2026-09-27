'use client';

import { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';

/**
 * Contact-form submissions.
 *
 * Triage only. What someone sent is never editable here — the message, name
 * and email stay exactly as submitted, because an inbox you can rewrite is
 * not a record of anything. Status and internal notes are the parts an admin
 * owns.
 */

type Status = 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  locale: string;
  status: Status;
  notes: string | null;
  createdAt: string;
  service: { translations: Array<{ locale: string; title: string }> } | null;
}

const STATUS_LABELS: Record<Status, string> = {
  NEW: 'Novo',
  READ: 'Pročitano',
  REPLIED: 'Odgovoreno',
  ARCHIVED: 'Arhivirano',
};

const STATUS_CLASSES: Record<Status, string> = {
  NEW: 'bg-ts-red/15 text-ts-red',
  READ: 'bg-blue-500/15 text-ts-blue',
  REPLIED: 'bg-emerald-500/15 text-emerald-400',
  ARCHIVED: 'bg-ts-surface-2 text-ts-muted',
};

const FILTERS: Array<{ value: Status | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Sve' },
  { value: 'NEW', label: 'Nova' },
  { value: 'READ', label: 'Pročitana' },
  { value: 'REPLIED', label: 'Odgovorena' },
  { value: 'ARCHIVED', label: 'Arhivirana' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InquiriesInbox({
  initialItems,
  initialTotal,
  initialNewCount,
}: {
  initialItems: Inquiry[];
  initialTotal: number;
  initialNewCount: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [newCount, setNewCount] = useState(initialNewCount);
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const load = async (nextPage: number, nextFilter: Status | 'ALL') => {
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (nextFilter !== 'ALL') query.set('status', nextFilter);
      const data = await adminApi.get<{
        items: Inquiry[];
        total: number;
        newCount: number;
      }>(`inquiries?${query.toString()}`);
      setItems(data.items);
      setTotal(data.total);
      setNewCount(data.newCount);
      setPage(nextPage);
      setFilter(nextFilter);
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Učitavanje nije uspelo.');
    }
  };

  const patch = async (id: string, payload: Record<string, unknown>) => {
    setError(null);
    try {
      const updated = await adminApi.patch<Inquiry>(`inquiries/${id}`, payload);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
      if (payload.status) {
        const wasNew = items.find((i) => i.id === id)?.status === 'NEW';
        if (wasNew && payload.status !== 'NEW') setNewCount((c) => Math.max(0, c - 1));
      }
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Izmena nije uspela.');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="admin-title">Upiti</h1>
        <p className="admin-subtitle">
          {total} ukupno{newCount > 0 ? ` · ${newCount} novih` : ''}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => load(1, entry.value)}
            aria-pressed={filter === entry.value}
            className={`admin-btn ${
              filter === entry.value ? 'admin-btn-primary' : 'admin-btn-ghost'
            }`}>
            {entry.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <Icon name="InboxIcon" size={32} className="text-ts-muted-2 mx-auto mb-3" />
          <p className="text-ts-muted">Nema upita.</p>
        </div>
      ) : (
        <ul className="admin-card divide-y divide-ts-border">
          {items.map((inquiry) => (
            <Row
              key={inquiry.id}
              inquiry={inquiry}
              open={openId === inquiry.id}
              onToggle={() => {
                const opening = openId !== inquiry.id;
                setOpenId(opening ? inquiry.id : null);
                // Opening an unread inquiry marks it read, the way an inbox does.
                if (opening && inquiry.status === 'NEW') patch(inquiry.id, { status: 'READ' });
              }}
              onPatch={(payload) => patch(inquiry.id, payload)}
            />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={page <= 1}
            onClick={() => load(page - 1, filter)}>
            Prethodna
          </button>
          <span className="text-sm text-ts-muted">
            {page} / {pages}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={page >= pages}
            onClick={() => load(page + 1, filter)}>
            Sledeća
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  inquiry,
  open,
  onToggle,
  onPatch,
}: {
  inquiry: Inquiry;
  open: boolean;
  onToggle: () => void;
  onPatch: (payload: Record<string, unknown>) => void;
}) {
  const [notes, setNotes] = useState(inquiry.notes ?? '');
  const service = inquiry.service?.translations.find((t) => t.locale === 'sr')?.title;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-ts-surface-2 transition-colors">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_CLASSES[inquiry.status]}`}>
          {STATUS_LABELS[inquiry.status]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ts-fg truncate">
            {inquiry.name}
            {inquiry.company ? ` · ${inquiry.company}` : ''}
          </span>
          <span className="block text-xs text-ts-muted truncate">{inquiry.message}</span>
        </span>
        <span className="text-xs text-ts-muted flex-shrink-0 hidden sm:block">
          {formatDate(inquiry.createdAt)}
        </span>
        <Icon
          name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'}
          size={16}
          className="text-ts-muted flex-shrink-0"
        />
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-4">
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-ts-muted">Email</dt>
              <dd>
                <a href={`mailto:${inquiry.email}`} className="text-ts-blue hover:underline">
                  {inquiry.email}
                </a>
              </dd>
            </div>
            {inquiry.phone && (
              <div className="flex gap-2">
                <dt className="text-ts-muted">Telefon</dt>
                <dd>
                  <a
                    href={`tel:${inquiry.phone.replace(/\s+/g, '')}`}
                    className="text-ts-blue hover:underline">
                    {inquiry.phone}
                  </a>
                </dd>
              </div>
            )}
            {service && (
              <div className="flex gap-2">
                <dt className="text-ts-muted">Usluga</dt>
                <dd className="text-ts-fg">{service}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-ts-muted">Jezik</dt>
              <dd className="text-ts-fg uppercase">{inquiry.locale}</dd>
            </div>
          </dl>

          {/* Submitted text, shown verbatim and never editable. */}
          <div className="rounded-xl border border-ts-border bg-ts-bg p-4">
            <p className="text-sm text-ts-fg whitespace-pre-wrap">{inquiry.message}</p>
          </div>

          <label className="block">
            <span className="admin-label">Interna beleška</span>
            <textarea
              className="admin-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Vidljivo samo u administraciji."
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => onPatch({ notes: notes.trim() === '' ? null : notes.trim() })}
              disabled={notes === (inquiry.notes ?? '')}>
              Sačuvaj belešku
            </button>

            <span className="mx-1 text-ts-muted text-sm">Status:</span>
            {(Object.keys(STATUS_LABELS) as Status[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onPatch({ status })}
                disabled={inquiry.status === status}
                className={`admin-btn ${
                  inquiry.status === status ? 'admin-btn-primary' : 'admin-btn-ghost'
                }`}>
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
