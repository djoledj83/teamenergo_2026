import Image from "next/image";
import AppLogo from "@/components/ui/AppLogo";
import Icon from "@/components/ui/AppIcon";
import SocialIcon from "@/components/ui/SocialIcon";
import { Link } from "@/i18n/navigation";
import {
  mediaUrl,
  type NavEntry,
  type SiteDocumentEntry,
} from "@/lib/api/public";
import { downloadFor } from "@/lib/download";

interface FooterCompany {
  key: string;
  name: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  pib: string | null;
  registrationNumber: string | null;
}

/**
 * One company's details in the footer: where it is, how to reach it, and the
 * two numbers that identify it.
 *
 * PIB and matični broj get no icon and sit below the rest, smaller. They are
 * there to be read off when somebody needs them for an invoice, not to be
 * clicked, and giving them icons would put them on the same footing as the
 * address and the phone number.
 *
 * Smaller, but not fainter: ts-muted-2 measures 2.35:1 against the footer's
 * background, under half the 4.5:1 that small text needs to be legible, and
 * these are digits somebody will copy down.
 */
function CompanyColumn({ company, heading }: { company: FooterCompany; heading: string | null }) {
  const { address, phone, email, pib, registrationNumber } = company;

  return (
    // min-w-0 so a long word shrinks the column rather than pushing past it:
    // a grid track is auto-sized to its content by default, and an email
    // address has nowhere obvious to break.
    <div className="space-y-4 min-w-0">
      {heading && (
        <p className="text-xs font-bold text-ts-fg uppercase tracking-widest">{heading}</p>
      )}

      <ul className="space-y-3 text-sm text-ts-muted">
        {address && (
          <li className="flex items-start gap-2">
            <Icon name="MapPinIcon" size={14} className="mt-0.5 flex-shrink-0 text-ts-red" />
            <span>{address}</span>
          </li>
        )}
        {phone && (
          <li className="flex items-start gap-2">
            <Icon name="PhoneIcon" size={14} className="mt-0.5 flex-shrink-0 text-ts-red" />
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="hover:text-ts-fg transition-colors break-words">
              {phone}
            </a>
          </li>
        )}
        {email && (
          <li className="flex items-start gap-2">
            <Icon name="EnvelopeIcon" size={14} className="mt-0.5 flex-shrink-0 text-ts-red" />
            <a href={`mailto:${email}`} className="hover:text-ts-fg transition-colors break-words">
              {email}
            </a>
          </li>
        )}
      </ul>

      {(pib || registrationNumber) && (
        <dl className="text-xs text-ts-muted space-y-1">
          {pib && (
            <div className="flex gap-1.5">
              <dt className="font-semibold">PIB:</dt>
              <dd>{pib}</dd>
            </div>
          )}
          {registrationNumber && (
            <div className="flex gap-1.5">
              <dt className="font-semibold">Matični broj:</dt>
              <dd>{registrationNumber}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

/** "Adresa, Grad, Država", skipping whatever has not been filled in. */
const joined = (...parts: Array<string | null>) => parts.filter(Boolean).join(", ");

/**
 * Site footer.
 *
 * Navigation and contact details come from the database — `nav_item` and the
 * `setting` table — so the client maintains them in the admin panel. Nothing
 * here is hardcoded: a detail that has not been filled in is omitted rather
 * than shown as a placeholder, which is how the old Ukrainian phone number
 * survived on the page for as long as it did.
 */
export default function Footer({
  nav = [],
  settings = {},
  documents = [],
}: {
  nav?: NavEntry[];
  settings?: Record<string, unknown>;
  documents?: SiteDocumentEntry[];
}) {
  const text = (key: string): string | null => {
    const value = settings[key];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  };

  const companyName = text("company.name") ?? "Teamenergo";
  const email = text("contact.email");

  // One block per company. The second appears only once its name is filled
  // in — the settings screen says so beside the field, because a column that
  // silently stays away is the kind of thing nobody ever works out.
  //
  // The main company's address lives under contact.* and its registration
  // numbers under company.*; the second company has one namespace to itself.
  // Not symmetrical, but renaming the keys the client has already filled in
  // would empty them, which is a worse trade than an odd-looking prefix.
  const companies = [
    {
      key: "main",
      name: companyName,
      address: joined(text("contact.address"), text("contact.city"), text("contact.country")),
      phone: text("contact.phone"),
      email,
      pib: text("company.pib"),
      registrationNumber: text("company.registrationNumber"),
    },
    {
      key: "subsidiary",
      name: text("subsidiary.name"),
      address: joined(
        text("subsidiary.address"),
        text("subsidiary.city"),
        text("subsidiary.country"),
      ),
      phone: text("subsidiary.phone"),
      email: text("subsidiary.email"),
      pib: text("subsidiary.pib"),
      registrationNumber: text("subsidiary.registrationNumber"),
    },
  ].filter(
    (company, index) =>
      // The first is the site's own company and shows whenever it has
      // anything to show; the second is opt-in, by name.
      (index === 0 || company.name) &&
      (company.address || company.phone || company.email || company.pib ||
        company.registrationNumber),
  );

  // Interpolated class names compile to nothing — Tailwind scans for whole
  // strings — so the two layouts are written out in full.
  //
  // Five across only from xl. At lg the five columns come to 163px each,
  // which is narrower than "montaza@teamenergo.rs" renders — the address
  // wrapped, the email did not, and it ran out past the edge of the column.
  // Two columns between 640 and 1280 make a taller footer and a readable one.
  const layout =
    companies.length > 1
      ? { grid: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-5", brand: "sm:col-span-2" }
      : { grid: "grid-cols-1 md:grid-cols-4", brand: "md:col-span-2" };

  const social = [
    { key: "social.linkedin", label: "LinkedIn", brand: "linkedin" as const },
    { key: "social.instagram", label: "Instagram", brand: "instagram" as const },
    { key: "social.facebook", label: "Facebook", brand: "facebook" as const },
  ]
    .map((entry) => ({ ...entry, url: text(entry.key) }))
    .filter((entry): entry is typeof entry & { url: string } => entry.url !== null);

  // A row with a logo is a badge, whether or not it also has a file behind
  // it; a row with only a file is a download link.
  // Built with flatMap rather than filter-then-assert: a filter narrows
  // nothing for the compiler, so the `!` that follows one is a claim nobody
  // checks — and the first row with a logo and no certificate proved it by
  // throwing on `doc.file!.path`.
  const badges = documents.flatMap((doc) => {
    const logo = mediaUrl(doc.logo);
    return logo ? [{ doc, logo, file: downloadFor(doc) }] : [];
  });
  const downloads = documents.flatMap((doc) => {
    if (doc.logo) return [];
    const file = downloadFor(doc);
    return file ? [{ doc, file }] : [];
  });

  // The listing is otherwise reachable only from a document's own page,
  // which makes it a dead end for anyone browsing and invisible to a
  // crawler following links.
  const hasPages = documents.some((doc) => doc.slug);

  return (
    <footer className="border-t border-ts-border py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className={`grid gap-10 mb-12 ${layout.grid}`}>
          {/* Brand */}
          <div className={`${layout.brand} space-y-4`}>
            <AppLogo size={200} iconName="BoltIcon" text="" />
            <div className="flex items-center gap-3 pt-2">
              {social.map((entry) => (
                <a
                  key={entry.key}
                  href={entry.url}
                  aria-label={entry.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-ts-border flex items-center justify-center text-ts-muted hover:text-ts-fg hover:border-ts-red transition-all">
                  <SocialIcon brand={entry.brand} size={16} />
                </a>
              ))}
              {email && (
                <a
                  href={`mailto:${email}`}
                  aria-label="Email"
                  className="w-9 h-9 rounded-full border border-ts-border flex items-center justify-center text-ts-muted hover:text-ts-fg hover:border-ts-red transition-all">
                  <Icon name="EnvelopeIcon" size={16} />
                </a>
              )}
            </div>
          </div>

          {/* Navigation */}
          {nav.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-ts-fg uppercase tracking-widest">Navigacija</p>
              <ul className="space-y-2 text-sm text-ts-muted">
                {nav.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="hover:text-ts-fg transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* One column per company. With a single company the heading stays
              "Kontakt", as it has always read; with two, each column is
              headed by its own name, because two columns both saying
              "Kontakt" tell the reader nothing. */}
          {companies.map((company) => (
            <CompanyColumn
              key={company.key}
              company={company}
              heading={companies.length > 1 ? company.name : "Kontakt"}
            />
          ))}
        </div>

        {documents.length > 0 && (
          <div className="border-t border-ts-border pt-10 pb-10 space-y-6">
            {/* Badges first — a certification logo is read at a glance.
                A badge opens the document's own page when it has one, which
                is what makes those pages reachable at all: a page nothing
                links to is a page no search engine will rank. The download
                button lives on that page. A document with no slug has no
                page yet, so its badge still goes straight to the file, as
                every badge did before. */}
            {badges.length > 0 && (
              <ul className="flex flex-wrap items-center gap-6">
                {badges.map(({ doc, logo, file }) => {
                  const badge = (
                    <span className="relative block w-20 h-20">
                      <Image
                        src={logo}
                        alt={doc.logo?.alt ?? doc.label}
                        fill
                        sizes="80px"
                        className="object-contain" />
                    </span>
                  );
                  const linkClass =
                    "block opacity-80 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red rounded";

                  return (
                    <li key={doc.id} title={doc.description ?? doc.label}>
                      {doc.slug ? (
                        <Link
                          href={`/sertifikati/${doc.slug}`}
                          className={linkClass}
                          aria-label={doc.label}>
                          {badge}
                        </Link>
                      ) : file ? (
                        <a
                          href={file.href}
                          className={linkClass}
                          aria-label={`${doc.label} — preuzmite dokument`}>
                          {badge}
                        </a>
                      ) : (
                        badge
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {hasPages && (
              <Link
                href="/sertifikati"
                className="inline-flex items-center gap-1.5 text-sm text-ts-muted hover:text-ts-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red rounded">
                Svi dokumenti i sertifikati
                <Icon name="ArrowRightIcon" size={13} className="text-ts-red" />
              </Link>
            )}

            {downloads.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-ts-fg uppercase tracking-widest">
                  Dokumenti
                </p>
                <ul className="flex flex-wrap gap-3">
                  {downloads.map(({ doc, file }) => (
                    <li key={doc.id}>
                      <a
                        href={file.href}
                        className="inline-flex items-center gap-2.5 text-sm text-ts-muted bg-ts-surface border border-ts-border rounded-full pl-3 pr-4 py-2 hover:text-ts-fg hover:border-ts-red transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red">
                        <Icon name="ArrowDownTrayIcon" size={14} className="text-ts-red flex-shrink-0" />
                        <span>{doc.label}</span>
                        <span className="text-[10px] font-bold text-ts-muted-2 uppercase tracking-wider">
                          {file.extension}
                          {file.size ? ` · ${file.size}` : ""}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-ts-border pt-8">
          <span className="text-ts-muted text-sm">
            © {new Date().getFullYear()} {companyName}
          </span>
        </div>
      </div>
    </footer>
  );
}
