"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Counts a page view, once per page.
 *
 * Client-side rather than counted on the server, because the pages are
 * cached: with ISR a second visitor to the same page is served the stored
 * HTML and the component never runs, so a counter there would report the
 * number of cache misses rather than the number of readers.
 *
 * `keepalive` so the request survives the visitor leaving immediately — a
 * normal fetch is cancelled when the page unloads, which would quietly lose
 * exactly the bounces worth knowing about. Failures are swallowed: an ad
 * blocker, an offline tab or a rejected write must never put an error in a
 * visitor's console over a counter.
 *
 * The ref guards React's development double-render and, more importantly,
 * the re-renders that a locale or search-param change causes without the
 * path changing.
 */
export default function Analytics({ locale }: { locale: string }) {
  const pathname = usePathname();
  const counted = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || counted.current === pathname) return;
    counted.current = pathname;

    // The referrer is sent whole and reduced to its host by the API, which
    // is the only place that knows what this site's own host is.
    const body = JSON.stringify({
      kind: "VIEW",
      path: pathname,
      locale,
      ...(document.referrer ? { referrer: document.referrer } : {}),
    });

    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* a counter is never worth a visible failure */
    });
  }, [pathname, locale]);

  return null;
}
