"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/AppIcon";
import AppImage from "@/components/ui/AppImage";
import { mediaUrl, type AlbumDetail } from "@/lib/api/public";

/**
 * An album's photos: a thumbnail grid that opens into a full-screen viewer.
 *
 * Thumbnails rather than full-width frames, because an album is something you
 * scan before you choose — a dozen photos should fit on one screen, not a
 * dozen screens. The big version is what the viewer is for.
 *
 * Each tile is a square crop at a small `sizes` hint, so next/image serves a
 * thumbnail-sized file instead of a full-resolution photo scaled down in the
 * browser. Getting `sizes` wrong here is the difference between a page that
 * loads in a moment and one that pulls several megabytes per row.
 */

type AlbumItem = AlbumDetail["items"][number];

export default function AlbumGallery({ items }: { items: AlbumItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const visible = items.filter((item) => item.media !== null);
  if (visible.length === 0) return null;

  return (
    <>
      {/* Same max width as the header above it, so the first thumbnail lines
          up with the title rather than sitting a few pixels to its left. */}
      <div className="max-w-5xl mx-auto px-6">
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {visible.map((item, index) => {
            const src = mediaUrl(item.media);
            if (!src) return null;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpen(index)}
                  title={item.caption ?? undefined}
                  aria-label={item.caption ?? `Otvori fotografiju ${index + 1}`}
                  className="group relative block w-full aspect-square rounded-xl overflow-hidden border border-ts-border hover:border-ts-red transition-colors">
                  <AppImage
                    src={src}
                    alt={item.media?.alt ?? item.caption ?? ""}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 15rem"
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />

                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors pointer-events-none" />
                  <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Icon name="ArrowsPointingOutIcon" size={15} className="text-white" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {open !== null && (
        <Lightbox
          items={visible}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: AlbumItem[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const item = items[index];

  const step = useCallback(
    (delta: number) => onIndex((index + delta + items.length) % items.length),
    [index, items.length, onIndex],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);

    // The page behind must not scroll away under the viewer. The previous
    // value is restored rather than assumed to be "": something else may own
    // it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, step]);

  const src = mediaUrl(item?.media);
  if (!item || !src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption ?? "Fotografija"}
      // Fully opaque, not black/95: the site header is fixed at z-50, and at
      // 95% it showed through the viewer as a ghost of the logo and menu.
      className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 text-white/70 text-sm">
        <span>
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zatvori"
          className="p-2 rounded-full hover:bg-white/10 hover:text-white transition-colors">
          <Icon name="XMarkIcon" size={22} />
        </button>
      </div>

      <div className="flex-1 relative min-h-0">
        <Image
          key={src}
          src={src}
          alt={item.media?.alt ?? item.caption ?? ""}
          fill
          sizes="100vw"
          quality={90}
          className="object-contain" />

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Prethodna"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
              <Icon name="ChevronLeftIcon" size={22} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Sledeća"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
              <Icon name="ChevronRightIcon" size={22} />
            </button>
          </>
        )}
      </div>

      {item.caption && (
        <p className="px-6 py-5 text-center text-sm text-white/80 max-w-3xl mx-auto">
          {item.caption}
        </p>
      )}
    </div>
  );
}
