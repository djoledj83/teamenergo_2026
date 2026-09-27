"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import AppLogo from "@/components/ui/AppLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { Bootstrap, NavEntry } from "@/lib/api/public";

/**
 * Site header.
 *
 * Navigation comes from the `nav_item` table via /public/bootstrap, so
 * adding, renaming or reordering an entry is done in the admin panel rather
 * than here. Link is the locale-aware one from i18n/navigation: an href of
 * "/usluge" stored in the database resolves to /sr/usluge or /en/usluge.
 */
export default function Header({
  nav,
  locales,
}: {
  nav: NavEntry[];
  locales?: Bootstrap["locales"];
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const available = locales?.map((entry) => entry.code);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#1E2D3D]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group" aria-label="Teamenergo">
          <AppLogo size={250} text="" className="group-hover:opacity-80 transition-opacity" />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((item) => (
            <NavLink key={item.id} item={item} />
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher available={available} />
        </div>

        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Otvori meni"
          aria-expanded={menuOpen}
        >
          <span
            className={`block w-6 h-0.5 bg-ts-fg transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            className={`block w-6 h-0.5 bg-ts-fg transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-6 h-0.5 bg-ts-fg transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </div>

      <div
        className={`md:hidden overflow-hidden transition-all duration-400 ${
          menuOpen ? "max-h-[32rem] border-b border-ts-border" : "max-h-0"
        } bg-[#0B0F14]/98 backdrop-blur-xl`}
      >
        <nav className="px-6 py-6 flex flex-col gap-4">
          {nav.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              className="text-ts-muted hover:text-ts-fg font-medium py-2 transition-colors border-b border-ts-border"
              onNavigate={() => setMenuOpen(false)}
            />
          ))}
          <div className="pt-2">
            <LanguageSwitcher available={available} />
          </div>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  item,
  className = "nav-link",
  onNavigate,
}: {
  item: NavEntry;
  className?: string;
  onNavigate?: () => void;
}) {
  // An absolute URL is an outbound link and must not be locale-prefixed.
  const isExternal = /^https?:\/\//.test(item.href);

  if (isExternal) {
    return (
      <a
        href={item.href}
        className={className}
        onClick={onNavigate}
        {...(item.opensInNew ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      onClick={onNavigate}
      {...(item.opensInNew ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {item.label}
    </Link>
  );
}
