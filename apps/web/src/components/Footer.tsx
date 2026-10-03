import Image from "next/image";
import AppLogo from "@/components/ui/AppLogo";
import Icon from "@/components/ui/AppIcon";
import { Link } from "@/i18n/navigation";
import {
  downloadUrl,
  mediaUrl,
  type NavEntry,
  type SiteDocumentEntry,
} from "@/lib/api/public";

/** "1,4 MB" — a reader deciding whether to tap a link wants the size. */
function fileSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const extensionOf = (path: string): string => {
  const ext = path.split(".").pop();
  return ext && ext.length <= 4 ? ext.toUpperCase() : "FAJL";
};

/**
 * Everything the footer needs about a row's download, or null when it has
 * none.
 *
 * One place that answers "is there a file, and what do I call it", because
 * both the badge strip and the download list need the same three facts and
 * the alternative is a non-null assertion at each use — which is exactly how
 * a certification with a logo but no certificate took the whole page down
 * with "Cannot read properties of null".
 */
function download(doc: SiteDocumentEntry) {
  if (!doc.file) return null;
  const extension = extensionOf(doc.file.path);
  return {
    href: downloadUrl(doc.file, `${doc.label}.${extension.toLowerCase()}`)!,
    extension,
    size: fileSize(doc.file.sizeBytes),
  };
}

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
  const phone = text("contact.phone");
  const address = [text("contact.address"), text("contact.city"), text("contact.country")]
    .filter(Boolean)
    .join(", ");

  const social = [
    { key: "social.linkedin", label: "LinkedIn", icon: "GlobeAltIcon" as const },
    { key: "social.instagram", label: "Instagram", icon: "ChatBubbleLeftRightIcon" as const },
    { key: "social.facebook", label: "Facebook", icon: "ChatBubbleLeftRightIcon" as const },
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
    return logo ? [{ doc, logo, file: download(doc) }] : [];
  });
  const downloads = documents.flatMap((doc) => {
    if (doc.logo) return [];
    const file = download(doc);
    return file ? [{ doc, file }] : [];
  });

  return (
    <footer className="border-t border-ts-border py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
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
                  <Icon name={entry.icon} size={16} />
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

          {/* Contact */}
          {(address || phone || email) && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-ts-fg uppercase tracking-widest">Kontakt</p>
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
                    <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-ts-fg transition-colors">
                      {phone}
                    </a>
                  </li>
                )}
                {email && (
                  <li className="flex items-start gap-2">
                    <Icon name="EnvelopeIcon" size={14} className="mt-0.5 flex-shrink-0 text-ts-red" />
                    <a href={`mailto:${email}`} className="hover:text-ts-fg transition-colors">
                      {email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {documents.length > 0 && (
          <div className="border-t border-ts-border pt-10 pb-10 space-y-6">
            {/* Badges first — a certification logo is read at a glance, and
                the ones that have a certificate behind them link to it. */}
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
                  return (
                    <li key={doc.id} title={doc.description ?? doc.label}>
                      {file ? (
                        <a
                          href={file.href}
                          className="block opacity-80 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red rounded"
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
