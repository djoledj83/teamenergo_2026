"use client";

import { useEffect, useRef } from "react";
import AppImage from "@/components/ui/AppImage";

/**
 * The album's cover behind its title, drifting as the page scrolls.
 *
 * The parallax moved here from the photo list. On the list it forced every
 * photo to be tall enough for the effect to read, which made a twelve-photo
 * album twelve screens long; a cover header is the one place on the page that
 * is full-bleed anyway, so the movement costs nothing.
 *
 * Three things this has to get right:
 *
 * - The untransformed state must look correct on its own. The image is
 *   cropped and centred in plain CSS, so the header is right before any
 *   JavaScript runs and stays right if it never does. The transform only ever
 *   shifts within the slack the oversized layer provides, so an edge can
 *   never appear.
 * - Scroll fires on every pixel. The position is read once per animation
 *   frame and written straight to `style.transform`, never through React
 *   state.
 * - Anyone who has asked their system not to animate things gets the same
 *   layout with nothing moving.
 */

/** Share of the header height the image may travel in either direction. */
const TRAVEL = 0.15;

export default function ParallaxCover({ src, alt }: { src: string; alt: string }) {
  const layer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const node = layer.current;
      const frameEl = node?.parentElement;
      if (!node || !frameEl) return;

      const box = frameEl.getBoundingClientRect();
      if (box.bottom < 0) return;

      // 0 with the header at the top of the viewport, growing as it leaves.
      const progress = Math.max(0, Math.min(1, -box.top / Math.max(box.height, 1)));
      node.style.transform = `translate3d(0, ${(progress * TRAVEL * box.height).toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <div
        ref={layer}
        className="absolute inset-x-0 will-change-transform"
        // Oversized upward: the layer only ever travels down, so the slack it
        // needs sits above the frame.
        style={{ top: `${-TRAVEL * 100}%`, height: `${(1 + TRAVEL) * 100}%` }}>
        <AppImage
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="object-cover w-full h-full" />
      </div>
    </div>
  );
}
