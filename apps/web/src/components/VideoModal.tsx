"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/AppIcon";

/**
 * A button that opens the company video in a modal.
 *
 * The iframe is mounted only while the modal is open. On a page where the
 * video is a secondary action, loading YouTube's player on arrival would cost
 * every visitor a few hundred kilobytes and a set of third-party cookies for
 * a film most of them will not watch.
 *
 * The embed URL is built from the parsed video id, never from the stored
 * string. The API already restricts the field to YouTube and Vimeo hosts;
 * this is the second half of the same rule — if the link cannot be parsed
 * into an id, nothing is rendered rather than something being framed.
 */

interface Embed {
  src: string;
  title: string;
}

export function toEmbed(url: string | null | undefined): Embed | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\.|^m\./, "");

  // youtu.be/<id> · youtube.com/watch?v=<id> · /embed/<id> · /shorts/<id>
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const fromPath = parsed.pathname.split("/").filter(Boolean);
    const id =
      host === "youtu.be"
        ? fromPath[0]
        : parsed.searchParams.get("v") ??
          (fromPath[0] === "embed" || fromPath[0] === "shorts" ? fromPath[1] : undefined);

    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    // nocookie: no tracking cookie until the visitor actually plays.
    return {
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`,
      title: "YouTube video",
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean).pop();
    if (!id || !/^\d{6,12}$/.test(id)) return null;
    return { src: `https://player.vimeo.com/video/${id}?autoplay=1`, title: "Vimeo video" };
  }

  return null;
}

export default function VideoModal({
  url,
  label,
}: {
  url: string | null | undefined;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const embed = toEmbed(url);

  // showModal() rather than an `open` attribute: it is what puts the dialog
  // in the top layer, traps focus, and makes Escape work without a key
  // handler of our own.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!embed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-3 bg-ts-surface border border-ts-border rounded-full pl-2 pr-6 py-2 hover:border-ts-red transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red">
        <span className="w-10 h-10 rounded-full bg-ts-red text-black flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <Icon name="PlayIcon" variant="solid" size={18} />
        </span>
        <span className="text-sm font-bold text-ts-fg">{label}</span>
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        // The backdrop is part of the dialog, so a click lands on the dialog
        // element itself; a click on the frame inside it does not.
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
        aria-label={label}
        className="bg-transparent p-0 w-full max-w-5xl backdrop:bg-black/80 open:flex items-center justify-center">
        <div className="w-full p-4">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zatvori"
              className="w-10 h-10 rounded-full bg-ts-surface border border-ts-border text-ts-fg flex items-center justify-center hover:border-ts-red transition-colors">
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
            {open && (
              <iframe
                src={embed.src}
                title={embed.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 w-full h-full border-0"
              />
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
