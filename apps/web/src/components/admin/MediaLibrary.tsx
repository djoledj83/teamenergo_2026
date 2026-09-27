'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from '@teamenergo/shared';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { ADMIN_LOCALES } from '@/lib/admin/collections';
import { mediaSrc, type MediaItem } from '@/lib/admin/media';

/**
 * The image library.
 *
 * Alt text is per language and editable here rather than at each point of
 * use, because one file appears in several places and its description does
 * not change with the context. Captions work the same way.
 *
 * Deletion is deliberately not a straight delete: the API refuses with a 409
 * and a breakdown of what still points at the file, and only a second,
 * explicit confirmation forces it. An image removed from under a published
 * page leaves a hole that nobody notices until a visitor does.
 */

export interface MediaDetail extends MediaItem {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  folder: string | null;
  createdAt: string;
  translations: Array<{ locale: string; alt: string | null; caption: string | null }>;
}

interface Usage {
  usageCount: number;
  usage: Record<string, number>;
}

const USAGE_LABELS: Record<string, string> = {
  services: 'usluge',
  projects: 'reference (naslovna)',
  projectImages: 'reference (galerija)',
  team: 'tim',
  posts: 'vesti',
  albums: 'albumi (naslovna)',
  galleryItems: 'galerija',
  testimonials: 'izjave',
  clients: 'klijenti',
  pageBlocks: 'blokovi stranica',
};

/** Everything the API will take, so the file dialog does not offer the rest. */
const ACCEPT =
  'image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const isImage = (media: { mimeType: string }) => media.mimeType.startsWith('image/');

const DOC_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibrary({
  initialItems,
  initialTotal,
}: {
  initialItems: MediaDetail[];
  initialTotal: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaDetail | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadCount, setUploadCount] = useState(0);
  const [kind, setKind] = useState<'all' | 'image' | 'document'>('all');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pageSize = 24;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const load = async (next: number, nextKind = kind) => {
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(next), pageSize: String(pageSize) });
      if (nextKind !== 'all') query.set('kind', nextKind);
      const data = await adminApi.get<{ items: MediaDetail[]; total: number }>(
        `media?${query.toString()}`,
      );
      setItems(data.items);
      setTotal(data.total);
      setPage(next);
      setKind(nextKind);
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Učitavanje nije uspelo.');
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setProgress(0);
    setUploadCount(files.length);
    setError(null);
    try {
      await adminApi.uploadWithProgress<{ items: MediaDetail[] }>(
        'media',
        Array.from(files),
        setProgress,
      );
      // Reload rather than prepending: the server decides ordering, and new
      // uploads can push older ones onto the next page.
      await load(1);
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Otpremanje nije uspelo.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="admin-title">Biblioteka slika</h1>
          <p className="admin-subtitle">
            {total} {total === 1 ? 'fajl' : 'fajlova'} · slike se konvertuju u WebP (do 3 MB),
            PDF i Word se čuvaju u originalu (do 10 MB)
          </p>
        </div>

        <label className="admin-btn admin-btn-primary cursor-pointer">
          <Icon name="ArrowUpTrayIcon" size={16} />
          {uploading ? 'Otpremanje…' : 'Otpremi slike'}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => upload(e.target.files)}
          />
        </label>
      </header>

      {uploading && (
        <div
          role="status"
          aria-live="polite"
          className="admin-card p-4 flex items-center gap-4">
          <Icon name="ArrowUpTrayIcon" size={18} className="text-ts-blue animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ts-fg mb-2">
              Otpremanje {uploadCount} {uploadCount === 1 ? 'fajla' : 'fajlova'} — {progress}%
            </p>
            <div className="h-1.5 rounded-full bg-ts-surface-2 overflow-hidden">
              <div
                className="h-full bg-ts-blue transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress === 100 && (
              <p className="text-xs text-ts-muted mt-2">Obrada na serveru…</p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'Sve'],
          ['image', 'Slike'],
          ['document', 'Dokumenti'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => load(1, value)}
            aria-pressed={kind === value}
            className={`admin-btn ${kind === value ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <Icon name="PhotoIcon" size={32} className="text-ts-muted-2 mx-auto mb-3" />
          <p className="text-ts-muted">
            Nema fajlova. Dozvoljene su slike, PDF i Word (.docx) dokumenti.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="group relative aspect-square rounded-xl overflow-hidden border border-ts-border bg-ts-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-blue">
              {isImage(item) ? (
                <Image
                  src={mediaSrc(item.path)}
                  alt={item.translations.find((t) => t.locale === DEFAULT_LOCALE)?.alt ?? ''}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ts-muted">
                  <Icon name="DocumentTextIcon" size={28} />
                  <span className="text-[10px] font-bold tracking-wider">
                    {DOC_LABELS[item.mimeType] ?? 'FAJL'}
                  </span>
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] text-white px-2 py-1 truncate text-left">
                {item.originalName}
              </span>
            </button>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={page <= 1}
            onClick={() => load(page - 1)}>
            Prethodna
          </button>
          <span className="text-sm text-ts-muted">
            {page} / {pages}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={page >= pages}
            onClick={() => load(page + 1)}>
            Sledeća
          </button>
        </div>
      )}

      {selected && (
        <DetailPanel
          media={selected}
          onClose={() => setSelected(null)}
          onSaved={(updated) => {
            setItems((current) =>
              current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
            );
            setSelected(updated);
          }}
          onDeleted={(id) => {
            setItems((current) => current.filter((item) => item.id !== id));
            setTotal((current) => current - 1);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function DetailPanel({
  media,
  onClose,
  onSaved,
  onDeleted,
}: {
  media: MediaDetail;
  onClose: () => void;
  onSaved: (media: MediaDetail) => void;
  onDeleted: (id: string) => void;
}) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [copy, setCopy] = useState(() => {
    const values: Record<string, { alt: string; caption: string }> = {};
    for (const code of ADMIN_LOCALES) {
      const row = media.translations.find((t) => t.locale === code);
      values[code] = { alt: row?.alt ?? '', caption: row?.caption ?? '' };
    }
    return values;
  });
  const [folder, setFolder] = useState(media.folder ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.patch<MediaDetail>(`media/${media.id}`, {
        folder: folder.trim() === '' ? null : folder.trim(),
        translations: Object.fromEntries(
          ADMIN_LOCALES.map((code) => [
            code,
            { alt: copy[code]!.alt.trim(), caption: copy[code]!.caption.trim() },
          ]),
        ),
      });
      onSaved(updated);
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Čuvanje nije uspelo.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (force: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.delete(`media/${media.id}${force ? '?force=true' : ''}`);
      onDeleted(media.id);
    } catch (cause) {
      if (cause instanceof AdminApiError && cause.status === 409) {
        // The API refused and said what still uses the file.
        setUsage(cause.details as Usage);
      } else {
        setError(cause instanceof AdminApiError ? cause.message : 'Brisanje nije uspelo.');
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const usedIn = usage
    ? Object.entries(usage.usage ?? {}).filter(([, count]) => count > 0)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={media.originalName}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div className="admin-card w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-ts-border">
          <h2 className="font-semibold text-ts-fg truncate">{media.originalName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori"
            className="p-2 rounded text-ts-muted hover:text-ts-fg">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6">
          <div className="space-y-3">
            {isImage(media) ? (
              <div className="relative aspect-square rounded-xl overflow-hidden border border-ts-border bg-ts-surface-2">
                <Image
                  src={mediaSrc(media.path)}
                  alt={copy[DEFAULT_LOCALE]?.alt ?? ''}
                  fill
                  sizes="(max-width: 768px) 90vw, 400px"
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="aspect-square rounded-xl border border-ts-border bg-ts-surface-2 flex flex-col items-center justify-center gap-4 text-ts-muted">
                <Icon name="DocumentTextIcon" size={48} />
                <span className="text-sm font-bold tracking-wider">
                  {DOC_LABELS[media.mimeType] ?? 'FAJL'}
                </span>
                <a
                  href={mediaSrc(media.path)}
                  download
                  className="admin-btn admin-btn-ghost">
                  <Icon name="ArrowDownTrayIcon" size={14} />
                  Preuzmi
                </a>
              </div>
            )}
            <dl className="text-xs text-ts-muted space-y-1">
              {isImage(media) && (
                <div className="flex justify-between gap-4">
                  <dt>Dimenzije</dt>
                  <dd>{media.width && media.height ? `${media.width}×${media.height}` : '—'}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt>Veličina</dt>
                <dd>{formatSize(media.sizeBytes)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Tip</dt>
                <dd>{media.mimeType}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-ts-border bg-ts-surface p-1">
              {ADMIN_LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  aria-pressed={code === locale}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    code === locale ? 'bg-ts-red text-black' : 'text-ts-muted hover:text-ts-fg'
                  }`}>
                  {LOCALE_LABELS[code] ?? code.toUpperCase()}
                </button>
              ))}
            </div>

            {isImage(media) && (
              <label className="block">
              <span className="admin-label">Alt tekst</span>
              <input
                className="admin-input"
                value={copy[locale]?.alt ?? ''}
                onChange={(e) =>
                  setCopy((c) => ({ ...c, [locale]: { ...c[locale]!, alt: e.target.value } }))
                }
                disabled={busy}
              />
              <span className="text-xs text-ts-muted mt-1 block">
                Opis slike za čitače ekrana i pretraživače.
              </span>
              </label>
            )}

            <label className="block">
              <span className="admin-label">{isImage(media) ? 'Potpis' : 'Naziv dokumenta'}</span>
              <textarea
                className="admin-textarea"
                value={copy[locale]?.caption ?? ''}
                onChange={(e) =>
                  setCopy((c) => ({ ...c, [locale]: { ...c[locale]!, caption: e.target.value } }))
                }
                disabled={busy}
              />
            </label>

            <label className="block">
              <span className="admin-label">Folder</span>
              <input
                className="admin-input"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="npr. reference"
                disabled={busy}
              />
            </label>

            {error && (
              <p role="alert" className="admin-error">
                {error}
              </p>
            )}

            {usage && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
                <p className="text-sm font-semibold text-ts-fg">
                  Slika se koristi na {usage.usageCount}{' '}
                  {usage.usageCount === 1 ? 'mestu' : 'mesta'}
                </p>
                <ul className="text-xs text-ts-muted space-y-0.5">
                  {usedIn.map(([key, count]) => (
                    <li key={key}>
                      {USAGE_LABELS[key] ?? key}: {count}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ts-muted">
                  Brisanjem će ta mesta ostati bez slike.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => remove(true)}
                    disabled={busy}>
                    Ipak obriši
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => setUsage(null)}>
                    Odustani
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={save}
                disabled={busy}>
                {busy ? 'Čuvanje…' : 'Sačuvaj'}
              </button>

              {!usage &&
                (confirming ? (
                  <>
                    <span className="text-sm text-ts-muted">Obrisati?</span>
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      onClick={() => remove(false)}
                      disabled={busy}>
                      Da
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => setConfirming(false)}>
                      Ne
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => setConfirming(true)}
                    disabled={busy}>
                    <Icon name="TrashIcon" size={14} />
                    Obriši
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
