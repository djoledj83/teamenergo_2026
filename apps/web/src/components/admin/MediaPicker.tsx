'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { adminApi } from '@/lib/admin/api';
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
  disabled?: boolean;
}

export default function MediaPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  // Resolve the stored id into something displayable.
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSelected(null);
      return;
    }
    adminApi
      .get<MediaItem>(`media/${value}`)
      .then((media) => {
        if (!cancelled) setSelected(media);
      })
      .catch(() => {
        // A dangling id (file deleted elsewhere) shows as empty rather than
        // breaking the whole form.
        if (!cancelled) setSelected(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-ts-border bg-ts-surface-2 flex-shrink-0">
          {selected ? (
            <Image
              src={mediaSrc(selected.path)}
              alt={mediaAlt(selected)}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ts-muted-2">
              <Icon name="PhotoIcon" size={22} />
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
            <Icon name="PhotoIcon" size={15} />
            {selected ? 'Promeni' : 'Izaberi sliku'}
          </button>
          {selected && (
            <button
              type="button"
              className="text-xs text-ts-muted hover:text-[#ef6b6b] text-left transition-colors"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              Ukloni
            </button>
          )}
        </div>
      </div>

      {open && (
        <MediaLibraryDialog
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
