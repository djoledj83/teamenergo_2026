'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { mediaAlt, mediaSrc, type MediaItem } from '@/lib/admin/media';
import MediaLibraryDialog from './MediaLibraryDialog';

/**
 * Picks one image from the media library, or uploads a new one.
 *
 * Stores a media id, never a URL — every image on the site is a foreign key
 * into the media table, which is what makes alt text translatable and lets
 * deletion warn about what still references a file.
 */

interface Props {
  value: string | null;
  onChange: (mediaId: string | null) => void;
  /** Images, or PDFs and Word documents. */
  kind?: 'image' | 'document';
  disabled?: boolean;
}

export default function MediaPicker({ value, onChange, kind = 'image', disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  // Resolve the stored id into something displayable.
  useEffect(() => {
    let cancelled = false;
    setUnreachable(false);
    if (!value) {
      setSelected(null);
      return;
    }
    adminApi
      .get<MediaItem>(`media/${value}`)
      .then((media) => {
        if (!cancelled) setSelected(media);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setSelected(null);
        // A 404 means the file was deleted elsewhere, and showing the field as
        // empty is right. Anything else means the thumbnail is missing for a
        // reason the editor should know about, because an empty-looking field
        // over an image that IS assigned reads as "nothing is chosen" — and
        // that is precisely how a missing GET /media/:id route stayed hidden.
        setUnreachable(!(cause instanceof AdminApiError && cause.status === 404));
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-ts-border bg-ts-surface-2 flex-shrink-0">
          {selected && kind === 'image' ? (
            <Image
              src={mediaSrc(selected.path)}
              alt={mediaAlt(selected)}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : selected ? (
            // A document has no thumbnail, so the filename is what identifies
            // it — "ISO-9001.pdf" tells the editor what is attached where a
            // generic file glyph would not.
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1.5 text-center">
              <Icon name="DocumentTextIcon" size={20} className="text-ts-muted" />
              <span className="text-[9px] leading-tight text-ts-muted break-all line-clamp-2">
                {selected.originalName}
              </span>
            </span>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ts-muted-2">
              <Icon name={kind === 'document' ? 'DocumentIcon' : 'PhotoIcon'} size={22} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => setOpen(true)}
            disabled={disabled}
          >
            <Icon name={kind === 'document' ? 'DocumentIcon' : 'PhotoIcon'} size={15} />
            {selected
              ? 'Promeni'
              : value
                ? 'Izaberi ponovo'
                : kind === 'document'
                  ? 'Izaberi dokument'
                  : 'Izaberi sliku'}
          </button>
          {(selected || value) && (
            <button
              type="button"
              className="text-xs text-ts-muted hover:text-[#ef6b6b] text-left transition-colors"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              Ukloni
            </button>
          )}
          {unreachable && (
            <p className="text-xs text-[#ef6b6b]">
              Fajl je izabran, ali pregled nije učitan.
            </p>
          )}
        </div>
      </div>

      {open && (
        <MediaLibraryDialog
          currentId={value}
          kind={kind}
          onClose={() => setOpen(false)}
          onPick={([media]) => {
            if (!media) return;
            onChange(media.id);
            setSelected(media);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
