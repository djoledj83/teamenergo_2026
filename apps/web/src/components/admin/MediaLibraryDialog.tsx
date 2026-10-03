'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { mediaAlt, mediaSrc, type MediaItem } from '@/lib/admin/media';

/**
 * Browse the library, or upload, and hand back what was chosen.
 *
 * One dialog serves both callers. A single-image field (`multiple` unset)
 * closes on the first click, because asking someone to click a picture and
 * then click "Done" for one image is a step for nothing. An album
 * (`multiple`) toggles a selection and confirms once — twenty photos should
 * be twenty clicks and one request, not twenty round trips.
 *
 * Freshly uploaded files are pre-selected in multi mode: uploading into an
 * album is the same intent as adding them to it, and making the user hunt for
 * their own upload in the grid afterwards was the obvious thing to get wrong.
 */

interface Props {
  onClose: () => void;
  /** Called with what was chosen. Always at least one item. */
  onPick: (media: MediaItem[]) => void;
  multiple?: boolean;
  /** Already in the album — shown greyed out and not selectable. */
  excludeIds?: readonly string[];
  /**
   * What the field holds right now, in single-pick mode. Marked in the grid so
   * reopening the picker shows which image is currently assigned instead of
   * presenting the library as though nothing were chosen.
   */
  currentId?: string | null;
  /** Which half of the library to show. Images by default. */
  kind?: 'image' | 'document';
  title?: string;
}

export default function MediaLibraryDialog({
  onClose,
  onPick,
  multiple = false,
  excludeIds = [],
  currentId = null,
  kind = 'image',
  title,
}: Props) {
  const heading = title ?? (kind === 'document' ? 'Biblioteka dokumenata' : 'Biblioteka slika');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const excluded = new Set(excludeIds);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // One half of the library at a time. A picker for a service photo
      // should not offer a PDF, and a picker for a certificate should not
      // make the editor scroll past two hundred photographs to find it.
      const data = await adminApi.get<{ items: MediaItem[] }>(
        `media?kind=${kind}&pageSize=100`,
      );
      setItems(data.items);
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : 'Učitavanje nije uspelo');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  // Escape closes, which is expected of any modal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadCount(files.length);
    setProgress(0);
    setError(null);
    try {
      // Same helper the standalone Media page uses, so the two agree on what
      // an upload looks like. It reports real bytes sent, which a plain fetch
      // cannot: on a phone tether, several photos with no readout is
      // indistinguishable from a frozen dialog.
      const result = await adminApi.uploadWithProgress<{ items: MediaItem[] }>(
        'media',
        Array.from(files),
        setProgress,
      );
      setItems((current) => [...result.items, ...current]);
      if (multiple) {
        setSelected((current) => [...current, ...result.items.map((media) => media.id)]);
      }
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : 'Otpremanje nije uspelo');
    } finally {
      setUploading(false);
      setUploadCount(0);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function choose(media: MediaItem) {
    if (excluded.has(media.id)) return;
    if (!multiple) {
      onPick([media]);
      return;
    }
    setSelected((current) =>
      current.includes(media.id)
        ? current.filter((id) => id !== media.id)
        : [...current, media.id],
    );
  }

  function confirm() {
    // Selection order is preserved, so the album ends up in the order the
    // pictures were clicked rather than whatever the library's sort was.
    const picked = selected
      .map((id) => items.find((media) => media.id === id))
      .filter((media): media is MediaItem => media !== undefined);
    if (picked.length > 0) onPick(picked);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <div className="admin-card w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-ts-border">
          <h2 className="font-display text-lg font-bold text-ts-fg">{heading}</h2>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={kind === 'document' ? '.pdf,.docx' : 'image/*'}
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Icon name="ArrowUpTrayIcon" size={15} />
              {uploading ? 'Otpremanje…' : 'Otpremi'}
            </button>
            {multiple && (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={confirm}
                disabled={selected.length === 0 || uploading}
              >
                <Icon name="CheckIcon" size={15} />
                Dodaj{selected.length > 0 ? ` (${selected.length})` : ''}
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={onClose}
              aria-label="Zatvori"
            >
              <Icon name="XMarkIcon" size={16} />
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="px-5 py-3 text-sm text-[#ef6b6b] border-b border-ts-border">
            {error}
          </p>
        )}

        {/* A visible, in-place readout rather than only a greyed-out button.
            Images are re-encoded to WebP on the server and several megabytes
            can take a few seconds, during which a dialog that looks idle
            invites a second click — and a second upload.

            At 100% the bytes are up but sharp is still working, so the bar
            stops and the label changes rather than sitting full and silent. */}
        {uploading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 px-5 py-3 border-b border-ts-border bg-ts-surface-2/40"
          >
            <Icon
              name="ArrowUpTrayIcon"
              size={16}
              className="text-ts-blue animate-pulse flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ts-fg mb-1.5">
                Otpremanje {uploadCount} {uploadCount === 1 ? 'fajla' : 'fajlova'} — {progress}%
              </p>
              <div className="h-1.5 rounded-full bg-ts-surface-2 overflow-hidden">
                <div
                  data-testid="upload-progress"
                  className="h-full bg-ts-blue transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {progress === 100 && (
                <p className="text-xs text-ts-muted mt-1.5">
                  Obrada na serveru — slike se konvertuju u WebP.
                </p>
              )}
            </div>
          </div>
        )}

        {multiple && !loading && items.length > 0 && (
          <p className="px-5 py-2.5 text-xs text-ts-muted border-b border-ts-border">
            Kliknite na slike koje želite da dodate, pa na „Dodaj“. Redosled klikanja je redosled
            u albumu.
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg bg-ts-surface-2 animate-pulse"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <Icon name="PhotoIcon" size={32} className="mx-auto text-ts-muted-2 mb-3" />
              <p className="text-sm text-ts-muted">Biblioteka je prazna.</p>
              <p className="text-xs text-ts-muted-2 mt-1">Otpremite prvu sliku da počnete.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {items.map((media) => {
                const isExcluded = excluded.has(media.id);
                const order = selected.indexOf(media.id);
                const isMultiSelected = order !== -1;
                const isCurrent = !multiple && media.id === currentId;
                const isSelected = isMultiSelected || isCurrent;

                return (
                  <button
                    key={media.id}
                    type="button"
                    onClick={() => choose(media)}
                    disabled={isExcluded}
                    title={isExcluded ? `${media.originalName} — već u albumu` : media.originalName}
                    aria-pressed={multiple ? isMultiSelected : isCurrent || undefined}
                    className={`group relative aspect-square rounded-lg overflow-hidden border transition-colors ${
                      isSelected
                        ? 'border-ts-blue ring-2 ring-ts-blue'
                        : 'border-ts-border hover:border-ts-blue'
                    } ${isExcluded ? 'opacity-35 cursor-not-allowed' : ''}`}
                  >
                    {kind === 'document' ? (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                        <Icon name="DocumentIcon" size={24} className="text-ts-muted" />
                        <span className="text-[10px] leading-tight text-ts-muted break-all line-clamp-3">
                          {media.originalName}
                        </span>
                      </span>
                    ) : (
                      <Image
                        src={mediaSrc(media.path)}
                        alt={mediaAlt(media)}
                        fill
                        sizes="140px"
                        className="object-cover"
                      />
                    )}
                    <span className="absolute inset-0 bg-ts-blue/0 group-hover:bg-ts-blue/20 transition-colors" />

                    {multiple && isMultiSelected && (
                      // The number, not just a tick: in an album the order is
                      // part of what is being chosen.
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ts-blue text-white text-xs font-bold flex items-center justify-center">
                        {order + 1}
                      </span>
                    )}

                    {isCurrent && (
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ts-blue text-white flex items-center justify-center">
                        <Icon name="CheckIcon" size={14} />
                      </span>
                    )}

                    {isExcluded && (
                      <span className="absolute bottom-1 left-1 right-1 text-[10px] font-bold text-ts-fg bg-black/70 rounded px-1 py-0.5">
                        U albumu
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
