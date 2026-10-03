"use client";

import { useState } from "react";
import Icon from "@/components/ui/AppIcon";

/**
 * A small map of the office, driven by the address rather than coordinates.
 *
 * Google's Embed API takes a place query directly, so the `contact.address`
 * settings that already feed the footer are the single source of truth. The
 * alternative — geocoding once and storing a latitude and longitude — gives
 * two things that can disagree, and silently keeps pointing at the old office
 * after somebody updates the address.
 *
 * Nothing loads until the visitor asks for it. A Google iframe sets
 * third-party cookies and pulls several hundred kilobytes, and on a contact
 * page the written address is what most people came for.
 *
 * Renders nothing without an API key, so a missing key is a missing map
 * rather than a broken frame.
 */
export default function ContactMap({
  address,
  label = "Prikaži mapu",
}: {
  address: string;
  label?: string;
}) {
  const [shown, setShown] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  if (!key || !address.trim()) return null;

  const src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
    key,
  )}&q=${encodeURIComponent(address)}&zoom=15`;

  return (
    <div className="mt-4">
      {shown ? (
        <div className="relative h-56 sm:h-64 rounded-2xl overflow-hidden border border-ts-border">
          <iframe
            src={src}
            title={`Mapa — ${address}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="inline-flex items-center gap-2 text-sm text-ts-muted hover:text-ts-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red rounded">
          <Icon name="MapPinIcon" size={15} className="text-ts-red" />
          {label}
        </button>
      )}
    </div>
  );
}
