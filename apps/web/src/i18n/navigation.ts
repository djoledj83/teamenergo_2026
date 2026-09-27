import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for next/link and the navigation hooks.
 *
 * Importing Link from here rather than from next/link means an href of
 * "/usluge" resolves to "/sr/usluge" or "/en/usluge" on its own. Every
 * public-side link should come from this module; the admin panel keeps using
 * next/link, since it is not locale-prefixed.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
