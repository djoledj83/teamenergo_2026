'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { adminApi, AdminApiError } from '@/lib/admin/api';
import { KNOWN_SETTING_KEYS, SETTINGS_GROUPS } from '@/lib/admin/settings';
import FormField, { type FieldValue } from './FormField';

/**
 * Site settings.
 *
 * Saved as one PUT of the whole map, because the API upserts every key it is
 * given inside a transaction — so either the screen's state lands intact or
 * none of it does. Settings are read together on every page of the site, and
 * a half-applied save would show a new address next to an old phone number.
 *
 * Values are stored as JSON, so a number stays a number and an empty field
 * becomes an empty string rather than the text "null".
 */

type Settings = Record<string, unknown>;

export default function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [values, setValues] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anything in the database that no group claims. Shown so a setting added
  // to the API cannot quietly become uneditable.
  const extraKeys = Object.keys(initial)
    .filter((key) => !KNOWN_SETTING_KEYS.has(key))
    .sort();

  const update = (key: string, value: FieldValue) => {
    setSaved(false);
    setValues((current) => ({ ...current, [key]: value ?? '' }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi.put('site/settings', values);
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Čuvanje nije uspelo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="admin-title">Podešavanja</h1>
          <p className="admin-subtitle">
            Podaci koji se pojavljuju na celom sajtu — kontakt, podaci kompanija i
            društvene mreže.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && !saving && (
            <span className="text-sm text-emerald-400 inline-flex items-center gap-1.5">
              <Icon name="CheckIcon" size={14} />
              Sačuvano
            </span>
          )}
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Čuvanje…' : 'Sačuvaj'}
          </button>
        </div>
      </header>

      {error && <p role="alert" className="admin-error">{error}</p>}

      {SETTINGS_GROUPS.map((group) => (
        <section key={group.title} className="admin-card p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-ts-fg">{group.title}</h2>
            {group.description && (
              <p className="text-xs text-ts-muted mt-0.5">{group.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {group.fields.map((field) => (
              <div key={field.key} className={field.span === 2 ? 'md:col-span-2' : ''}>
                <FormField
                  field={field}
                  value={(values[field.key] as FieldValue) ?? ''}
                  onChange={(value) => update(field.key, value)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {extraKeys.length > 0 && (
        <section className="admin-card p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-ts-fg">Ostalo</h2>
            <p className="text-xs text-ts-muted mt-0.5">
              Podešavanja koja postoje u bazi ali nisu razvrstana u grupe iznad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {extraKeys.map((key) => (
              <div key={key}>
                <FormField
                  field={{ name: key, label: key, type: 'text' }}
                  value={(values[key] as FieldValue) ?? ''}
                  onChange={(value) => update(key, value)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </form>
  );
}
