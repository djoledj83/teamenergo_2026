import AppLogo from "@/components/ui/AppLogo";
import Icon from "@/components/ui/AppIcon";
import { Link } from "@/i18n/navigation";
import type { NavEntry } from "@/lib/api/public";

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
}: {
  nav?: NavEntry[];
  settings?: Record<string, unknown>;
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

        <div className="border-t border-ts-border pt-8">
          <span className="text-ts-muted text-sm">
            © {new Date().getFullYear()} {companyName}
          </span>
        </div>
      </div>
    </footer>
  );
}
