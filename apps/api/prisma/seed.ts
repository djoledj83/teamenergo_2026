/**
 * Database seed — idempotent.
 *
 * Every seeded row uses a stable, explicit id so re-running updates in place
 * rather than duplicating. Safe to run against an existing database.
 *
 *   npm run db:seed
 *
 * Content note: the text below is what actually existed in the old hardcoded
 * homepage, with the Serbian Y/Z keyboard typos corrected. Anything that was
 * placeholder or belonged to the original template is marked PLACEHOLDER and
 * is meant to be replaced through the admin panel — see PLACEHOLDERS.md.
 */
import { pathToFileURL } from 'node:url';
import { PrismaClient, AdminRole } from '@prisma/client';
import { slugify } from '@teamenergo/shared';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const SR = 'sr';
const EN = 'en';

// ─────────────────────────────────────────────────────────────────────────
// Locales
// ─────────────────────────────────────────────────────────────────────────

async function seedLocales() {
  await prisma.locale.upsert({
    where: { code: SR },
    update: { name: 'Srpski', isDefault: true, isActive: true, sortOrder: 0 },
    create: { code: SR, name: 'Srpski', isDefault: true, isActive: true, sortOrder: 0 },
  });
  await prisma.locale.upsert({
    where: { code: EN },
    update: { name: 'English', isDefault: false, isActive: true, sortOrder: 1 },
    create: { code: EN, name: 'English', isDefault: false, isActive: true, sortOrder: 1 },
  });
  console.info(`  locales: ${await prisma.locale.count()}`);
}

// ─────────────────────────────────────────────────────────────────────────
// First admin user
// ─────────────────────────────────────────────────────────────────────────

export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    console.warn('  admin user: SKIPPED (set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD in .env)');
    return;
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (existing) {
    // The account exists. Whether ADMIN_INITIAL_PASSWORD still applies to it
    // depends on whether a human has since chosen their own password.
    //
    // mustChangePassword is the marker: it is set at creation and cleared the
    // first time someone changes the password through the admin panel. While
    // it is still true, nobody owns this password but .env, so .env is the
    // source of truth and re-syncing is exactly what is expected. Once it is
    // false, the stored password belongs to a person and the seed must not
    // overwrite it — that is what db:reset-admin is for.
    if (!existing.mustChangePassword) {
      console.info(
        `  admin user: ${email} has a password set by its owner — left untouched.\n` +
          '              (locked out? run: npm run db:reset-admin)',
      );
      return;
    }

    const alreadyMatches = await argon2.verify(existing.passwordHash, password).catch(() => false);
    if (alreadyMatches) {
      console.info(`  admin user: ${email} already matches ADMIN_INITIAL_PASSWORD`);
      return;
    }

    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        isActive: true,
      },
    });
    // Any session minted against the old password should not outlive it.
    const { count } = await prisma.refreshToken.updateMany({
      where: { adminUserId: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    console.info(
      `  admin user: ${email} password re-synced from ADMIN_INITIAL_PASSWORD` +
        (count > 0 ? ` (${count} session(s) revoked)` : ''),
    );
    return;
  }

  // argon2id is the default variant and the one to use for passwords.
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name: 'Administrator',
      role: AdminRole.OWNER,
      isActive: true,
      // Forces a change on first login, so the .env value is never a
      // long-lived credential.
      mustChangePassword: true,
    },
  });
  console.info(`  admin user: ${email} created (password change required at first login)`);
}

// ─────────────────────────────────────────────────────────────────────────
// Site settings — not translated; none of these differ by language
// ─────────────────────────────────────────────────────────────────────────

const SETTINGS: Record<string, unknown> = {
  'contact.email': 'info@teamenergo.com',
  // PLACEHOLDER: the old site carried "+380 11 123 4567". +380 is Ukraine —
  // it came from the template this design was built on. Left empty rather
  // than guessed; fill it in through the admin panel.
  'contact.phone': '',
  'contact.address': 'Mije Aleksića 43a, Beograd — Zemun, Srbija',
  'contact.city': 'Beograd',
  'contact.country': 'Srbija',
  'company.name': 'Teamenergo d.o.o.',
  'company.foundedYear': null, // PLACEHOLDER: hero said "since (pa br godina)"
  'social.linkedin': '',
  'social.instagram': '',
  'social.facebook': '',
  'map.lat': null,
  'map.lng': null,
};

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},               // never overwrite values an admin has edited
      create: { key, value: value as never },
    });
  }
  console.info(`  settings: ${await prisma.setting.count()} keys`);
}

// ─────────────────────────────────────────────────────────────────────────
// Pages and their editable blocks
// ─────────────────────────────────────────────────────────────────────────

const PAGES: Array<{
  key: string;
  sr: { title: string; seoTitle?: string; seoDescription?: string };
  en: { title: string; seoTitle?: string; seoDescription?: string };
}> = [
  {
    key: 'home',
    sr: {
      title: 'Početna',
      seoTitle: 'Teamenergo | Telekomunikacije i energetska infrastruktura',
      seoDescription:
        'Teamenergo projektuje i gradi telekomunikacionu i energetsku infrastrukturu — od optičkih mreža i sistema tehničke zaštite do obnovljivih izvora energije i e-mobilnosti.',
    },
    en: {
      title: 'Home',
      seoTitle: 'Teamenergo | Telecommunications and energy infrastructure',
      seoDescription:
        'Teamenergo designs and builds telecommunications and energy infrastructure — from fibre networks and technical protection systems to renewable energy and e-mobility.',
    },
  },
  {
    key: 'about',
    sr: { title: 'O nama', seoTitle: 'O nama | Teamenergo' },
    en: { title: 'About us', seoTitle: 'About us | Teamenergo' },
  },
  {
    key: 'team',
    sr: { title: 'Tim', seoTitle: 'Naš tim | Teamenergo' },
    en: { title: 'Team', seoTitle: 'Our team | Teamenergo' },
  },
  {
    key: 'services',
    sr: { title: 'Usluge', seoTitle: 'Usluge | Teamenergo' },
    en: { title: 'Services', seoTitle: 'Services | Teamenergo' },
  },
  {
    key: 'projects',
    sr: { title: 'Reference', seoTitle: 'Reference | Teamenergo' },
    en: { title: 'Projects', seoTitle: 'Projects | Teamenergo' },
  },
  {
    key: 'news',
    sr: { title: 'Vesti', seoTitle: 'Vesti | Teamenergo' },
    en: { title: 'News', seoTitle: 'News | Teamenergo' },
  },
  {
    key: 'gallery',
    sr: { title: 'Galerija', seoTitle: 'Galerija | Teamenergo' },
    en: { title: 'Gallery', seoTitle: 'Gallery | Teamenergo' },
  },
  {
    key: 'contact',
    sr: { title: 'Kontakt', seoTitle: 'Kontakt | Teamenergo' },
    en: { title: 'Contact', seoTitle: 'Contact | Teamenergo' },
  },
];

async function seedPages() {
  for (const page of PAGES) {
    await prisma.page.upsert({
      where: { key: page.key },
      update: {},
      create: { key: page.key },
    });

    for (const [locale, copy] of [[SR, page.sr], [EN, page.en]] as const) {
      await prisma.pageTranslation.upsert({
        where: { pageKey_locale: { pageKey: page.key, locale } },
        update: {},
        create: {
          pageKey: page.key,
          locale,
          title: copy.title,
          seoTitle: copy.seoTitle ?? null,
          seoDescription: copy.seoDescription ?? null,
        },
      });
    }
  }
  console.info(`  pages: ${await prisma.page.count()}`);
}

const PAGE_BLOCKS = [
  {
    id: 'blk_home_hero',
    pageKey: 'home',
    blockKey: 'hero',
    sortOrder: 0,
    sr: {
      eyebrow: 'Pouzdan partner u energetici',
      heading: 'Gradimo infrastrukturu koja pokreće',
      subheading: 'Telekomunikacije, energetika i obnovljivi izvori.',
      body:
        'Teamenergo je odličan partner jer razume da savremeni čovek i moderan način života ' +
        'podrazumevaju besprekornost funkcionisanja sredstava moderne komunikacije, ' +
        'signalizacije i transporta koji su uvek dostupni. Pouzdana infrastruktura je temelj ' +
        'svih tehnoloških inovacija koje pružaju kompanijama i poslovnom čoveku prednost u ' +
        'tržišnoj borbi.',
      ctaLabel: 'Pogledajte usluge',
      ctaHref: '/usluge',
    },
    en: {
      eyebrow: 'A reliable partner in energy',
      heading: 'Building the infrastructure that powers',
      subheading: 'Telecommunications, energy and renewables.',
      body:
        'Teamenergo understands that modern life depends on communication, signalling and ' +
        'transport systems that simply work, and are always available. Reliable infrastructure ' +
        'is the foundation of every technological advance that gives a company its edge.',
      ctaLabel: 'Explore services',
      ctaHref: '/services',
    },
  },
  {
    id: 'blk_home_video',
    pageKey: 'home',
    blockKey: 'video',
    sortOrder: 1,
    sr: {
      eyebrow: null,
      heading: 'Pogledajte kako radimo',
      subheading: null,
      body: null,
      ctaLabel: 'Pogledajte naš video',
      ctaHref: null,
    },
    en: {
      eyebrow: null,
      heading: 'See how we work',
      subheading: null,
      body: null,
      ctaLabel: 'Watch our company video',
      ctaHref: null,
    },
  },
  {
    id: 'blk_home_contact',
    pageKey: 'home',
    blockKey: 'contact',
    sortOrder: 2,
    sr: {
      eyebrow: 'Kontaktirajte nas',
      heading: 'Želite da sarađujemo?',
      subheading: 'Pišite nam.',
      body:
        '<p>Pošaljite nam osnovne podatke o projektu — obimu, roku i tehničkim ' +
        'zahtevima — i javićemo se sa predlogom sledećih koraka.</p>',
      ctaLabel: null,
      ctaHref: null,
    },
    en: {
      eyebrow: 'Get in touch',
      heading: 'Want to work together?',
      subheading: 'Write to us.',
      body:
        '<p>Send us the essentials — scope, timeline and technical requirements ' +
        '— and we will come back with the next steps.</p>',
      ctaLabel: null,
      ctaHref: null,
    },
  },
  {
    id: 'blk_about_intro',
    pageKey: 'about',
    blockKey: 'intro',
    sortOrder: 0,
    sr: {
      eyebrow: 'O nama',
      heading: 'Struka, standardi i provera kvaliteta',
      subheading: null,
      body:
        '<p>Da bi se naš život i navike savremenog čoveka nesmetano odvijale, kako bi ' +
        'privreda i ritam rada određene zemlje bio u korak sa svetom, neophodno je ' +
        'poštovati najviše kriterijume struke, stalno uvoditi nove standarde, inovacije ' +
        'i proveru kvaliteta.</p>',
      ctaLabel: null,
      ctaHref: null,
    },
    en: {
      eyebrow: 'About us',
      heading: 'Expertise, standards and quality control',
      subheading: null,
      body:
        '<p>For everyday life to run uninterrupted, and for a country\'s economy to keep ' +
        'pace with the world, the highest professional standards have to be met and ' +
        'renewed — continuously, with new standards, innovation and quality control.</p>',
      ctaLabel: null,
      ctaHref: null,
    },
  },
  {
    id: 'blk_about_team',
    pageKey: 'about',
    blockKey: 'capital',
    sortOrder: 1,
    sr: {
      eyebrow: 'Intelektualni kapital',
      heading: 'Licencirani inženjeri i sertifikovani tehničari',
      subheading: null,
      body:
        '<p>Intelektualni kapital čine licencirani inženjeri, projektni menadžeri i ' +
        'sertifikovani tehničari. Tim ostvarenih profesionalaca vodi računa o kvalitetu ' +
        'implementacije tehničkih rešenja, što doprinosi pozitivnoj i kreativnoj radnoj ' +
        'atmosferi koja iznova donosi uzbuđenje pri novim projektima.</p>',
      ctaLabel: 'Upoznajte tim',
      ctaHref: '/tim',
    },
    en: {
      eyebrow: 'Intellectual capital',
      heading: 'Licensed engineers and certified technicians',
      subheading: null,
      body:
        '<p>Our intellectual capital is made up of licensed engineers, project managers ' +
        'and certified technicians — a team of accomplished professionals who take care ' +
        'over how technical solutions are implemented.</p>',
      ctaLabel: 'Meet the team',
      ctaHref: '/tim',
    },
  },
  {
    id: 'blk_about_approach',
    pageKey: 'about',
    blockKey: 'approach',
    sortOrder: 2,
    sr: {
      eyebrow: 'Pristup',
      heading: 'Kompletna usluga, od planiranja do predaje',
      subheading: null,
      body:
        '<p>Multidisciplinarnost i timski rad omogućavaju nam da našim naručiocima ' +
        'osiguramo kompletan set usluga — od predinvesticionih aktivnosti i planiranja, ' +
        'do aktivnosti u fazi gradnje i konačne predaje objekta.</p>',
      ctaLabel: 'Pogledajte usluge',
      ctaHref: '/usluge',
    },
    en: {
      eyebrow: 'How we work',
      heading: 'A complete service, from planning to handover',
      subheading: null,
      body:
        '<p>Multidisciplinary teams let us give our clients a complete set of services — ' +
        'from pre-investment work and planning, through construction, to final ' +
        'handover of the facility.</p>',
      ctaLabel: 'Explore services',
      ctaHref: '/services',
    },
  },
  {
    id: 'blk_home_intro',
    pageKey: 'home',
    blockKey: 'intro',
    sortOrder: 1,
    sr: {
      eyebrow: 'Šta nas izdvaja',
      heading: 'Struka, standardi i provera kvaliteta',
      subheading: null,
      body:
        'Da bi se naš život i navike savremenog čoveka nesmetano odvijale, kako bi privreda i ' +
        'ritam rada određene zemlje bio u korak sa svetom, neophodno je poštovati najviše ' +
        'kriterijume struke, stalno uvoditi nove standarde, inovacije i proveru kvaliteta.',
      ctaLabel: null,
      ctaHref: null,
    },
    en: {
      eyebrow: 'What sets us apart',
      heading: 'Expertise, standards and quality control',
      subheading: null,
      body:
        'For everyday life and the rhythm of a country’s economy to keep pace with the world, ' +
        'the highest professional criteria must be met, with new standards, innovation and ' +
        'quality control introduced continuously.',
      ctaLabel: null,
      ctaHref: null,
    },
  },
  {
    id: 'blk_contact_intro',
    pageKey: 'contact',
    blockKey: 'intro',
    sortOrder: 0,
    sr: {
      eyebrow: 'Kontaktirajte nas',
      heading: 'Želite da sarađujemo?',
      subheading: 'Pišite nam.',
      body:
        'Javite nam se sa detaljima projekta — odgovaramo u roku od jednog radnog dana.',
      ctaLabel: null,
      ctaHref: null,
    },
    en: {
      eyebrow: 'Get in touch',
      heading: 'Want to work together?',
      subheading: 'Write to us.',
      body: 'Send us the details of your project — we reply within one business day.',
      ctaLabel: null,
      ctaHref: null,
    },
  },
];

async function seedPageBlocks() {
  for (const block of PAGE_BLOCKS) {
    await prisma.pageBlock.upsert({
      where: { pageKey_blockKey: { pageKey: block.pageKey, blockKey: block.blockKey } },
      update: {},
      create: {
        id: block.id,
        pageKey: block.pageKey,
        blockKey: block.blockKey,
        sortOrder: block.sortOrder,
        isVisible: true,
      },
    });

    for (const [locale, copy] of [[SR, block.sr], [EN, block.en]] as const) {
      await prisma.pageBlockTranslation.upsert({
        where: { pageBlockId_locale: { pageBlockId: block.id, locale } },
        update: {},
        create: {
          pageBlockId: block.id,
          locale,
          eyebrow: copy.eyebrow,
          heading: copy.heading,
          subheading: copy.subheading,
          body: copy.body,
          ctaLabel: copy.ctaLabel,
          ctaHref: copy.ctaHref,
        },
      });
    }
  }
  console.info(`  page blocks: ${await prisma.pageBlock.count()}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'nav_about', href: '/o-nama', sr: 'O nama', en: 'About', sortOrder: 0 },
  { id: 'nav_services', href: '/usluge', sr: 'Usluge', en: 'Services', sortOrder: 1 },
  { id: 'nav_projects', href: '/reference', sr: 'Reference', en: 'Projects', sortOrder: 2 },
  { id: 'nav_team', href: '/tim', sr: 'Tim', en: 'Team', sortOrder: 3 },
  { id: 'nav_news', href: '/vesti', sr: 'Vesti', en: 'News', sortOrder: 4 },
  { id: 'nav_gallery', href: '/galerija', sr: 'Galerija', en: 'Gallery', sortOrder: 5 },
  { id: 'nav_contact', href: '/kontakt', sr: 'Kontakt', en: 'Contact', sortOrder: 6 },
];

async function seedNavigation() {
  for (const item of NAV_ITEMS) {
    await prisma.navItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        location: 'header',
        href: item.href,
        sortOrder: item.sortOrder,
        isVisible: true,
      },
    });

    for (const [locale, label] of [[SR, item.sr], [EN, item.en]] as const) {
      await prisma.navItemTranslation.upsert({
        where: { navItemId_locale: { navItemId: item.id, locale } },
        update: {},
        create: { navItemId: item.id, locale, label },
      });
    }
  }
  console.info(`  nav items: ${await prisma.navItem.count()}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Services
//
// Taken from the footer of the existing site, which is the only place the
// real service list appeared. The homepage cards described a Ukrainian
// power-transmission company and are discarded.
// ─────────────────────────────────────────────────────────────────────────

const SERVICES = [
  {
    id: 'svc_telekomunikacije',
    iconName: 'SignalIcon',
    accent: 'blue',
    sr: { slug: 'telekomunikacije', title: 'Telekomunikacije', category: 'Infrastruktura' },
    en: { slug: 'telecommunications', title: 'Telecommunications', category: 'Infrastructure' },
  },
  {
    id: 'svc_energetika',
    iconName: 'BoltIcon',
    accent: 'amber',
    sr: { slug: 'energetika', title: 'Energetika', category: 'Infrastruktura' },
    en: { slug: 'energy', title: 'Energy', category: 'Infrastructure' },
  },
  {
    id: 'svc_vodovod',
    iconName: 'BeakerIcon',
    accent: 'blue',
    sr: {
      slug: 'vodovod-i-kanalizacija',
      title: 'Vodovod i kanalizacija',
      category: 'Komunalna infrastruktura',
    },
    en: {
      slug: 'water-and-sewerage',
      title: 'Water and sewerage',
      category: 'Utility infrastructure',
    },
  },
  {
    id: 'svc_oie',
    iconName: 'SunIcon',
    accent: 'amber',
    sr: {
      slug: 'obnovljivi-izvori-energije',
      title: 'Obnovljivi izvori energije',
      category: 'Energetika',
    },
    en: { slug: 'renewable-energy', title: 'Renewable energy', category: 'Energy' },
  },
  {
    id: 'svc_tehnicka_zastita',
    iconName: 'ShieldCheckIcon',
    accent: 'blue',
    sr: {
      slug: 'sistemi-tehnicke-zastite',
      title: 'Sistemi tehničke zaštite',
      category: 'Bezbednost',
    },
    en: {
      slug: 'technical-protection-systems',
      title: 'Technical protection systems',
      category: 'Security',
    },
  },
  {
    id: 'svc_e_mobilnost',
    iconName: 'BoltIcon',
    accent: 'amber',
    sr: { slug: 'e-mobilnost', title: 'E-mobilnost', category: 'Energetika' },
    en: { slug: 'e-mobility', title: 'E-mobility', category: 'Energy' },
  },
];

/**
 * Explains why one service could not be written.
 *
 * Slugs are unique per language, so the usual cause is a row created through
 * the admin panel that has taken a slug the seed wants. Naming that row turns
 * an opaque count mismatch into something actionable.
 */
async function explainServiceFailure(
  service: (typeof SERVICES)[number],
  error: unknown,
): Promise<string> {
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : String(error);

  if (code !== 'P2002') return message.split('\n')[0] ?? message;

  const target = (error as { meta?: { target?: string[] | string } }).meta?.target;
  const fields = Array.isArray(target) ? target : [target].filter(Boolean);

  if (fields.includes('slug')) {
    for (const [locale, copy] of [[SR, service.sr], [EN, service.en]] as const) {
      const holder = await prisma.serviceTranslation.findFirst({
        where: { locale, slug: copy.slug },
        select: { serviceId: true, title: true },
      });
      if (holder && holder.serviceId !== service.id) {
        return `slug "${copy.slug}" (${locale}) is already used by service ${holder.serviceId} — "${holder.title}"`;
      }
    }
  }

  return `unique constraint on ${fields.join(', ') || 'unknown field'}`;
}

async function seedServices() {
  const failures: Array<{ id: string; reason: string }> = [];

  for (const [index, service] of SERVICES.entries()) {
    // Each service is written independently. One bad row used to abort the
    // whole loop, which is how the database ended up with a single service
    // and no explanation — the remaining five were never attempted.
    try {
      await prisma.service.upsert({
        where: { id: service.id },
        update: {},
        create: {
          id: service.id,
          iconName: service.iconName,
          accent: service.accent,
          sortOrder: index,
          isPublished: true,
          isFeatured: index < 3,
        },
      });

      for (const [locale, copy] of [[SR, service.sr], [EN, service.en]] as const) {
        await prisma.serviceTranslation.upsert({
          where: { serviceId_locale: { serviceId: service.id, locale } },
          update: {},
          create: {
            serviceId: service.id,
            locale,
            slug: copy.slug,
            title: copy.title,
            category: copy.category,
            // PLACEHOLDER: no real service descriptions existed on the old site.
            summary: null,
            body: null,
          },
        });
      }
      console.info(`    · ${service.id} (${service.sr.title})`);
    } catch (error) {
      const reason = await explainServiceFailure(service, error);
      failures.push({ id: service.id, reason });
      console.warn(`    ! ${service.id} SKIPPED — ${reason}`);
    }
  }

  console.info(
    `  services: ${await prisma.service.count()} (${await prisma.serviceTranslation.count()} translations)`,
  );

  if (failures.length > 0) {
    console.warn(
      `\n  ${failures.length} service(s) could not be written. Each one above names\n` +
        '  the row that blocks it. Either rename that row\'s slug in /admin or\n' +
        '  delete it, then re-run: npm run db:seed\n',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Homepage statistics
//
// PLACEHOLDER: every figure on the old homepage (500+ projects, 1,200 MW,
// 99.98% grid reliability) came from the original template and describes a
// different company. Structure is seeded so the admin has rows to edit;
// values are zero and must be replaced with real numbers before launch.
// ─────────────────────────────────────────────────────────────────────────

const STATS = [
  {
    id: 'stat_projects',
    iconName: 'BriefcaseIcon',
    accent: 'amber',
    suffix: '+',
    sr: { label: 'Završenih projekata', description: 'PLACEHOLDER — uneti stvarni podatak' },
    en: { label: 'Completed projects', description: 'PLACEHOLDER — replace with real figure' },
  },
  {
    id: 'stat_years',
    iconName: 'ClockIcon',
    accent: 'blue',
    suffix: '',
    sr: { label: 'Godina iskustva', description: 'PLACEHOLDER — uneti stvarni podatak' },
    en: { label: 'Years of experience', description: 'PLACEHOLDER — replace with real figure' },
  },
  {
    id: 'stat_clients',
    iconName: 'UserGroupIcon',
    accent: 'amber',
    suffix: '+',
    sr: { label: 'Zadovoljnih klijenata', description: 'PLACEHOLDER — uneti stvarni podatak' },
    en: { label: 'Satisfied clients', description: 'PLACEHOLDER — replace with real figure' },
  },
  {
    id: 'stat_team',
    iconName: 'UsersIcon',
    accent: 'blue',
    suffix: '',
    sr: { label: 'Članova tima', description: 'PLACEHOLDER — uneti stvarni podatak' },
    en: { label: 'Team members', description: 'PLACEHOLDER — replace with real figure' },
  },
];

async function seedStats() {
  for (const [index, stat] of STATS.entries()) {
    await prisma.stat.upsert({
      where: { id: stat.id },
      update: {},
      create: {
        id: stat.id,
        value: 0,
        suffix: stat.suffix,
        iconName: stat.iconName,
        accent: stat.accent,
        sortOrder: index,
        isPublished: false, // hidden until real numbers are entered
      },
    });

    for (const [locale, copy] of [[SR, stat.sr], [EN, stat.en]] as const) {
      await prisma.statTranslation.upsert({
        where: { statId_locale: { statId: stat.id, locale } },
        update: {},
        create: {
          statId: stat.id,
          locale,
          label: copy.label,
          description: copy.description,
        },
      });
    }
  }
  console.info(`  stats: ${await prisma.stat.count()} (unpublished — values are placeholders)`);
}

// ─────────────────────────────────────────────────────────────────────────
// Clients / partners — the ticker bar
// Real company names from the existing site.
// ─────────────────────────────────────────────────────────────────────────

const CLIENTS = [
  'Telekom Srbija',
  'Elektrovojvodina',
  'Elektroizgradnja d.o.o.',
  'Transnafta',
  'Srbijaautoput',
  'Smatsa',
  'Skijališta Srbije',
  'Telegroup',
  'Yettel',
  'A1',
  'Conexio',
  'Flender',
  'Traffic',
  'Subotica',
];

async function seedClients() {
  for (const [index, name] of CLIENTS.entries()) {
    const id = `cli_${index}`;
    await prisma.client.upsert({
      where: { id },
      update: {},
      create: { id, name, sortOrder: index, isPublished: true },
    });
  }
  console.info(`  clients: ${await prisma.client.count()}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Testimonials — genuine Serbian copy from the existing site
// ─────────────────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    id: 'tst_1',
    sr: {
      quote:
        'Intelektualni kapital čine licencirani inženjeri, projektni menadžeri i sertifikovani ' +
        'tehničari. Tim ostvarenih profesionalaca vodi računa o kvalitetu implementacije ' +
        'tehničkih rešenja, što doprinosi pozitivnoj i kreativnoj radnoj atmosferi koja iznova ' +
        'donosi uzbuđenje pri novim projektima.',
      name: 'Aleksandar Radivojević',
      role: 'Glavni inženjer',
      company: 'Teamenergo d.o.o.',
    },
    en: {
      quote:
        'Our intellectual capital consists of licensed engineers, project managers and certified ' +
        'technicians. A team of accomplished professionals oversees the quality of every ' +
        'technical implementation, which creates the positive, creative atmosphere that makes ' +
        'each new project exciting.',
      name: 'Aleksandar Radivojević',
      role: 'Chief Engineer',
      company: 'Teamenergo d.o.o.',
    },
  },
  {
    id: 'tst_2',
    sr: {
      quote:
        'Multidisciplinarnost i timski rad omogućavaju nam da našim naručiocima osiguramo ' +
        'kompletan set usluga — od predinvesticionih aktivnosti i planiranja, do aktivnosti u ' +
        'fazi gradnje i konačne predaje objekta.',
      name: 'Aleksandar Radivojević',
      role: 'Glavni inženjer',
      company: 'Teamenergo d.o.o.',
    },
    en: {
      quote:
        'A multidisciplinary approach and teamwork let us offer clients a complete set of ' +
        'services — from pre-investment work and planning through construction to final handover.',
      name: 'Aleksandar Radivojević',
      role: 'Chief Engineer',
      company: 'Teamenergo d.o.o.',
    },
  },
];

async function seedTestimonials() {
  for (const [index, testimonial] of TESTIMONIALS.entries()) {
    await prisma.testimonial.upsert({
      where: { id: testimonial.id },
      update: {},
      create: { id: testimonial.id, sortOrder: index, isPublished: true },
    });

    for (const [locale, copy] of [[SR, testimonial.sr], [EN, testimonial.en]] as const) {
      await prisma.testimonialTranslation.upsert({
        where: { testimonialId_locale: { testimonialId: testimonial.id, locale } },
        update: {},
        create: {
          testimonialId: testimonial.id,
          locale,
          quote: copy.quote,
          name: copy.name,
          role: copy.role,
          company: copy.company,
        },
      });
    }
  }
  console.info(`  testimonials: ${await prisma.testimonial.count()}`);
}

// ─────────────────────────────────────────────────────────────────────────
// News categories — structure only, no posts
// ─────────────────────────────────────────────────────────────────────────

const POST_CATEGORIES = [
  { id: 'cat_novosti', sr: { slug: 'novosti', name: 'Novosti' }, en: { slug: 'news', name: 'News' } },
  {
    id: 'cat_projekti',
    sr: { slug: 'projekti', name: 'Projekti' },
    en: { slug: 'projects', name: 'Projects' },
  },
];

async function seedPostCategories() {
  for (const [index, category] of POST_CATEGORIES.entries()) {
    await prisma.postCategory.upsert({
      where: { id: category.id },
      update: {},
      create: { id: category.id, sortOrder: index },
    });

    for (const [locale, copy] of [[SR, category.sr], [EN, category.en]] as const) {
      await prisma.postCategoryTranslation.upsert({
        where: { postCategoryId_locale: { postCategoryId: category.id, locale } },
        update: {},
        create: {
          postCategoryId: category.id,
          locale,
          slug: copy.slug,
          name: copy.name,
        },
      });
    }
  }
  console.info(`  post categories: ${await prisma.postCategory.count()}`);
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * Gives every team member a slug.
 *
 * The column was added after members could already be created through the
 * admin, so existing rows have none and their pages would 404. Derived from
 * the name, deduplicated within the language, and only ever filling blanks —
 * a slug somebody has set deliberately is never rewritten, because changing
 * it would break whatever already links to it.
 */
async function backfillTeamSlugs() {
  const missing = await prisma.teamMemberTranslation.findMany({
    where: { slug: null },
    select: { id: true, locale: true, name: true },
  });

  if (missing.length === 0) return;

  for (const row of missing) {
    const base = slugify(row.name) || `clan-${row.id.slice(-6)}`;
    let candidate = base;

    // Two people can share a name; the slug cannot.
    for (let attempt = 2; attempt < 100; attempt += 1) {
      const clash = await prisma.teamMemberTranslation.findFirst({
        where: { locale: row.locale, slug: candidate },
        select: { id: true },
      });
      if (!clash) break;
      candidate = `${base}-${attempt}`;
    }

    await prisma.teamMemberTranslation.update({
      where: { id: row.id },
      data: { slug: candidate },
    });
    console.info(`    · ${row.locale}/${candidate}`);
  }

  console.info(`  team slugs backfilled: ${missing.length}`);
}

async function main() {
  console.info('Seeding Teamenergo database…');
  await seedLocales();
  await seedAdminUser();
  await seedSettings();
  await seedPages();
  await seedPageBlocks();
  await seedNavigation();
  await seedServices();
  await seedStats();
  await seedClients();
  await seedTestimonials();
  await seedPostCategories();
  await backfillTeamSlugs();
  const expected = {
    locale: 2,
    page: PAGES.length,
    pageBlock: PAGE_BLOCKS.length,
    navItem: NAV_ITEMS.length,
    service: SERVICES.length,
    stat: STATS.length,
    client: CLIENTS.length,
    testimonial: TESTIMONIALS.length,
    postCategory: POST_CATEGORIES.length,
  } as const;

  const actual = {
    locale: await prisma.locale.count(),
    page: await prisma.page.count(),
    pageBlock: await prisma.pageBlock.count(),
    navItem: await prisma.navItem.count(),
    service: await prisma.service.count(),
    stat: await prisma.stat.count(),
    client: await prisma.client.count(),
    testimonial: await prisma.testimonial.count(),
    postCategory: await prisma.postCategory.count(),
  };

  const mismatches = Object.entries(expected).filter(
    ([key, count]) => actual[key as keyof typeof actual] !== count,
  );

  if (mismatches.length > 0) {
    console.warn('\nSeed finished but some counts do not match:');
    for (const [key, count] of mismatches) {
      console.warn(`  ${key}: expected ${count}, found ${actual[key as keyof typeof actual]}`);
    }
    console.warn('Rows may have been deleted since seeding, or an upsert matched an existing id.\n');
  } else {
    console.info('Seed complete — all counts match.');
  }
}

/**
 * Run the whole seed only when this file is the entry point.
 *
 * Importing it — which tests do, to exercise one step in isolation — must not
 * kick off every other step as a side effect of the import.
 */
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main()
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
