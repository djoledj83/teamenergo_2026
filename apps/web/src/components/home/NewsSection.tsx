"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/AppIcon";
import { Link } from "@/i18n/navigation";

/**
 * Latest news, as a horizontal rail.
 *
 * Scroll-snap rather than a carousel library. The browser already does
 * momentum, touch, trackpad and keyboard scrolling natively, and does them
 * better than JavaScript can; Swiper or Embla would add about forty kilobytes
 * to re-implement them. The arrows are the only part that needs code, and
 * they are two calls to scrollBy.
 *
 * The rail degrades to a plain scrollable row with no JS at all — the cards
 * are server-rendered children, so they are in the HTML either way.
 */
export default function NewsSection({
  children,
  count,
  total,
}: {
  /** Pre-rendered PostCards, so the cards stay off the client bundle. */
  children: React.ReactNode;
  count: number;
  total?: number;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    // A pixel of slack: fractional widths mean scrollLeft rarely lands
    // exactly on the maximum, and a button that never enables is worse than
    // one that enables a pixel early.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [sync, count]);

  // One card plus its gap, measured rather than assumed, so the step stays
  // right across the three breakpoints the card widths change at.
  const step = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const width = first ? first.offsetWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: width * direction, behavior: "smooth" });
  };

  if (count === 0) return null;
  const hasMore = (total ?? count) > count;

  return (
    <section id="news" className="pb-32 px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-ts-surface border border-ts-border rounded-full px-4 py-1.5">
              <Icon name="NewspaperIcon" size={14} className="text-ts-red" />
              <span className="text-xs font-bold text-ts-muted uppercase tracking-widest">
                Vesti
              </span>
            </div>
            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-black text-ts-fg leading-tight tracking-tight">
              Šta je <span className="text-gradient-red italic">novo.</span>
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Hidden where swiping is the natural gesture. On a touch screen
                these are two targets competing with the thing they scroll. */}
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={atStart}
                aria-label="Prethodne vesti"
                className="w-10 h-10 rounded-full border border-ts-border flex items-center justify-center text-ts-muted enabled:hover:bg-ts-red enabled:hover:border-ts-red enabled:hover:text-black disabled:opacity-30 transition-all">
                <Icon name="ArrowLeftIcon" size={15} />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={atEnd}
                aria-label="Sledeće vesti"
                className="w-10 h-10 rounded-full border border-ts-border flex items-center justify-center text-ts-muted enabled:hover:bg-ts-red enabled:hover:border-ts-red enabled:hover:text-black disabled:opacity-30 transition-all">
                <Icon name="ArrowRightIcon" size={15} />
              </button>
            </div>

            {hasMore && (
              <Link
                href="/vesti"
                className="inline-flex items-center gap-2 text-sm font-bold text-ts-fg hover:text-ts-red transition-colors">
                Prikaži sve vesti
                <Icon name="ArrowRightIcon" size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Full-bleed rail with a gutter that lines the first card up with the
          heading above it, so the row reads as starting at the margin while
          cards still run off the right edge — which is what tells a reader
          there is more to scroll.

          scroll-pl must match the padding. Scroll snapping aligns against the
          SNAPPORT, which padding does not move but scroll-padding does; with
          only padding set, the browser snapped the first card's edge to the
          content box and the rail came to rest 60px in at this width. It
          looked fine and quietly broke the left arrow, which reads that
          resting position as "not at the start". */}
      <div
        ref={rail}
        role="region"
        aria-label="Najnovije vesti"
        tabIndex={0}
        className="mt-10 flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 -mx-6
                   px-[max(1.5rem,calc((100vw-80rem)/2))]
                   scroll-pl-[max(1.5rem,calc((100vw-80rem)/2))]
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red rounded-3xl
                   [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                   [&>*]:snap-start [&>*]:flex-shrink-0
                   [&>*]:w-[78vw] sm:[&>*]:w-[55vw] md:[&>*]:w-[42vw] lg:[&>*]:w-[30%]">
        {children}
      </div>
    </section>
  );
}
