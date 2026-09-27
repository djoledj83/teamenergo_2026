"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import Icon from "@/components/ui/AppIcon";
import type { PageBlock, ServiceSummary } from "@/lib/api/public";

/**
 * Contact form.
 *
 * Posts to /api/inquiries, which forwards to the API and writes a row the
 * admin's Upiti inbox reads. Until this was wired the submit button set a
 * "thank you" state and discarded everything typed into it.
 *
 * The copy beside the form and the contact details both come from the
 * database — the `contact` page block and the settings — so the +380 number
 * that shipped with the template cannot come back.
 */

interface FieldIssue {
  path?: string;
  message?: string;
}

const EMPTY = { name: "", email: "", phone: "", company: "", serviceId: "", message: "" };

export default function ContactSection({
  block,
  services = [],
  settings = {},
}: {
  block?: PageBlock | null;
  services?: ServiceSummary[];
  settings?: Record<string, unknown>;
}) {
  const locale = useLocale();
  const [form, setForm] = useState(EMPTY);
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const text = (key: string): string | null => {
    const value = settings[key];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  };

  const details = [
    text("contact.phone") && {
      icon: "PhoneIcon",
      label: "Telefon",
      value: text("contact.phone")!,
    },
    text("contact.email") && {
      icon: "EnvelopeIcon",
      label: "Email",
      value: text("contact.email")!,
    },
    [text("contact.address"), text("contact.city"), text("contact.country")]
      .filter(Boolean)
      .join(", ") && {
      icon: "MapPinIcon",
      label: "Lokacija",
      value: [text("contact.address"), text("contact.city"), text("contact.country")]
        .filter(Boolean)
        .join(", "),
    },
  ].filter((entry): entry is { icon: string; label: string; value: string } => Boolean(entry));

  const change = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          // Optional fields are omitted rather than sent empty, which the
          // schema would reject as a too-short string.
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.company.trim() ? { company: form.company.trim() } : {}),
          ...(form.serviceId ? { serviceId: form.serviceId } : {}),
          message: form.message.trim(),
          locale,
          website,
        }),
      });

      if (response.ok) {
        setSent(true);
        setForm(EMPTY);
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string; details?: FieldIssue[] };
      } | null;

      if (response.status === 429) {
        setError("Previše pokušaja. Sačekajte nekoliko minuta pa pokušajte ponovo.");
        return;
      }

      const details = payload?.error?.details;
      if (Array.isArray(details)) {
        const mapped: Record<string, string> = {};
        for (const issue of details) {
          if (issue.path && issue.message) mapped[issue.path] = issue.message;
        }
        setFieldErrors(mapped);
      }
      setError(payload?.error?.message ?? "Slanje nije uspelo. Pokušajte ponovo.");
    } catch {
      setError("Veza je prekinuta. Proverite internet i pokušajte ponovo.");
    } finally {
      setSending(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full bg-ts-bg border rounded-xl px-4 py-3 text-ts-fg placeholder-ts-muted-2 text-sm focus:outline-none transition-colors ${
      fieldErrors[field] ? "border-ts-red" : "border-ts-border focus:border-ts-accent"
    }`;

  return (
    <section
      id="contact"
      className="py-32 px-6 relative"
      style={{ background: "linear-gradient(180deg, #0B0F14 0%, #0D1520 60%, #0B0F14 100%)" }}>
      <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left — copy and details, both from the database */}
          <div className="space-y-10 lg:sticky lg:top-28">
            <div className="space-y-4">
              {block?.eyebrow && (
                <div className="inline-flex items-center gap-2 bg-ts-surface border border-ts-border rounded-full px-4 py-1.5">
                  <Icon name="PhoneIcon" size={14} className="text-ts-red" />
                  <span className="text-xs font-bold text-ts-muted uppercase tracking-widest">
                    {block.eyebrow}
                  </span>
                </div>
              )}

              {(block?.heading || block?.subheading) && (
                <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-black text-ts-fg leading-tight tracking-tight">
                  {block.heading}
                  {block.subheading && (
                    <>
                      {" "}
                      <span className="text-gradient-red italic">{block.subheading}</span>
                    </>
                  )}
                </h2>
              )}

              {block?.body && (
                // Sanitised by the API on write.
                <div
                  className="text-ts-muted leading-relaxed max-w-md [&>p]:mb-3 [&>p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: block.body }} />
              )}
            </div>

            {details.length > 0 && (
              <div className="space-y-4">
                {details.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-4 p-4 bg-ts-surface border border-ts-border rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Icon name={item.icon} size={16} className="text-ts-red" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-ts-muted font-bold uppercase tracking-wider">
                        {item.label}
                      </p>
                      <p className="text-ts-fg font-medium text-sm break-words">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — the form */}
          <div className="bg-ts-surface border border-ts-border rounded-[32px] p-8 lg:p-10">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Icon name="CheckBadgeIcon" size={32} className="text-ts-red" variant="solid" />
                </div>
                <h3 className="font-display text-2xl font-bold text-ts-fg">Poruka je poslata</h3>
                <p className="text-ts-muted max-w-xs">
                  Hvala na upitu. Javićemo vam se u najkraćem roku.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-4 text-sm font-bold text-ts-accent hover:underline">
                  Pošaljite još jednu poruku
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-6" noValidate>
                <h3 className="font-display text-xl font-bold text-ts-fg mb-2">
                  Kontaktirajte nas putem forme
                </h3>

                {/* Honeypot: off-screen and hidden from assistive technology.
                    A real person never fills it in; a bot fills everything. */}
                <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Vaše ime *" error={fieldErrors.name}>
                    <input
                      type="text"
                      name="name"
                      required
                      value={form.name}
                      onChange={change}
                      disabled={sending}
                      autoComplete="name"
                      className={inputClass("name")}
                    />
                  </Field>

                  <Field label="Vaš email *" error={fieldErrors.email}>
                    <input
                      type="email"
                      name="email"
                      required
                      value={form.email}
                      onChange={change}
                      disabled={sending}
                      autoComplete="email"
                      className={inputClass("email")}
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Telefon" error={fieldErrors.phone}>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={change}
                      disabled={sending}
                      autoComplete="tel"
                      className={inputClass("phone")}
                    />
                  </Field>

                  <Field label="Kompanija / ustanova" error={fieldErrors.company}>
                    <input
                      type="text"
                      name="company"
                      value={form.company}
                      onChange={change}
                      disabled={sending}
                      autoComplete="organization"
                      className={inputClass("company")}
                    />
                  </Field>
                </div>

                {services.length > 0 && (
                  <Field label="Odaberite uslugu" error={fieldErrors.serviceId}>
                    <select
                      name="serviceId"
                      value={form.serviceId}
                      onChange={change}
                      disabled={sending}
                      className={`${inputClass("serviceId")} appearance-none`}>
                      <option value="">Oblast delovanja…</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Detalji projekta *" error={fieldErrors.message}>
                  <textarea
                    name="message"
                    rows={4}
                    required
                    value={form.message}
                    onChange={change}
                    disabled={sending}
                    placeholder="Opišite opseg projekta, vremenski okvir i tehničke zahteve…"
                    className={`${inputClass("message")} resize-none`}
                  />
                </Field>

                {error && (
                  <p role="alert" className="text-sm text-ts-red">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-ts-red text-white py-4 rounded-xl font-bold text-sm hover:bg-amber-400 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2">
                  {sending ? "Slanje…" : "Pošaljite zahtev za projekat"}
                  {!sending && <Icon name="ArrowRightIcon" size={16} />}
                </button>

                <p className="text-center text-xs text-ts-muted">
                  Odgovor možete očekivati u najkraćem roku.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-ts-muted uppercase tracking-wider block">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-ts-red">{error}</p>}
    </div>
  );
}
