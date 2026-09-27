"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { sr: "SRB", en: "EN" };

/**
 * Switches language while staying on the same page.
 *
 * `usePathname` from i18n/navigation returns the path WITHOUT the locale
 * prefix, so the same value goes to every locale's link and next-intl
 * re-prefixes it — /sr/usluge and /en/usluge from one value.
 *
 * Content slugs ARE per-language, so /sr/usluge/energetika becomes
 * /en/usluge/energetika, which does not exist: the English translation is
 * "energy". Detail pages therefore have to resolve an unknown slug against
 * the other locale and redirect, rather than 404. Nothing depends on that
 * yet — the section pages are the next piece of work — but the switcher is
 * correct for every page that exists today.
 */
export default function LanguageSwitcher({ available }: { available?: string[] }) {
  const active = useLocale();
  const pathname = usePathname();

  // The API reports which languages are actually enabled; fall back to the
  // configured set when it could not be reached.
  const codes = routing.locales.filter(
    (code) => !available || available.length === 0 || available.includes(code),
  );

  if (codes.length < 2) return null;

  return (
    <div className="inline-flex items-center rounded-full border border-ts-border bg-ts-surface p-1">
      {codes.map((code) => (
        <Link
          key={code}
          href={pathname}
          locale={code}
          hrefLang={code}
          aria-current={code === active ? "true" : undefined}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
            code === active
              ? "bg-ts-red text-black"
              : "text-ts-muted hover:text-ts-fg"
          }`}
        >
          {LABELS[code] ?? code.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
