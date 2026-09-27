"use client";

import type { ClientEntry } from "@/lib/api/public";

/**
 * The scrolling client strip along the bottom of the hero.
 *
 * Names come from the `client` collection, the same rows the logo wall at the
 * bottom of the page uses — they were hardcoded here as a second, separate
 * list, so adding a client meant editing one of them and wondering why the
 * other had not changed.
 *
 * The list is rendered twice because the animation translates the track by
 * exactly half its width: the second copy is what occupies the gap the first
 * one leaves as it scrolls out, so the loop has no visible seam.
 */
export default function TickerBar({ clients }: { clients: ClientEntry[] }) {
  if (clients.length === 0) return null;

  const doubled = [...clients, ...clients];

  return (
    <div className="overflow-hidden border-y border-ts-border bg-ts-surface/80 backdrop-blur-md py-4">
      <div className="ticker-track flex gap-12 w-max">
        {doubled.map((client, i) => (
          <div key={`${client.id}-${i}`} className="flex items-center gap-4 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-ts-accent flex-shrink-0" />
            <span className="text-sm font-semibold text-ts-muted uppercase tracking-widest whitespace-nowrap">
              {client.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
