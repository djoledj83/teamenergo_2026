'use client';

import dynamic from 'next/dynamic';
import { slugify } from '@teamenergo/shared';
import type { FieldConfig } from '@/lib/admin/collections';
import Icon from '@/components/ui/AppIcon';
import MediaPicker from './MediaPicker';

// The editor pulls in ProseMirror; loading it on demand keeps it out of the
// initial bundle for forms that have no rich text field.
const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => <div className="admin-input h-48 animate-pulse" aria-hidden="true" />,
});

export type FieldValue = string | number | boolean | null | undefined;

interface Props {
  field: FieldConfig;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  error?: string | undefined;
  disabled?: boolean;
  /** Used to derive a slug when the slug field is left empty. */
  slugSource?: string | undefined;
}

export default function FormField({
  field,
  value,
  onChange,
  error,
  disabled,
  slugSource,
}: Props) {
  const id = `field-${field.name}`;
  const describedBy = error ? `${id}-error` : field.help ? `${id}-help` : undefined;

  const control = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            id={id}
            className="admin-textarea"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        );

      case 'richtext':
        return (
          <RichTextEditor
            value={(value as string) ?? ''}
            onChange={(html) => onChange(html)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        );

      case 'boolean':
        return (
          <button
            type="button"
            id={id}
            role="switch"
            aria-checked={Boolean(value)}
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? 'bg-ts-blue' : 'bg-ts-surface-2'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );

      case 'select':
        return (
          <select
            id={id}
            className="admin-select"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            aria-describedby={describedBy}
          >
            <option value="">—</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'image':
      case 'document':
        return (
          <MediaPicker
            value={(value as string) ?? null}
            onChange={(mediaId) => onChange(mediaId)}
            kind={field.type === 'document' ? 'document' : 'image'}
            disabled={disabled}
          />
        );

      case 'number':
        return (
          <input
            id={id}
            type="number"
            step="any"
            className="admin-input"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        );

      case 'date':
        return (
          <input
            id={id}
            type="date"
            className="admin-input"
            // The API returns ISO timestamps; the input needs YYYY-MM-DD.
            value={value ? String(value).slice(0, 10) : ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            aria-describedby={describedBy}
          />
        );

      case 'slug':
        return (
          <div className="flex gap-2">
            <input
              id={id}
              type="text"
              className="admin-input font-mono text-xs"
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={slugSource ? slugify(slugSource) : 'automatski'}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
            />
            <button
              type="button"
              className="admin-btn admin-btn-ghost flex-shrink-0"
              disabled={disabled || !slugSource}
              onClick={() => onChange(slugify(slugSource ?? ''))}
              title="Napravi slug iz naslova"
            >
              <Icon name="ArrowPathIcon" size={15} />
            </button>
          </div>
        );

      default:
        return (
          <input
            id={id}
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            className="admin-input"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        );
    }
  };

  return (
    <div className={field.span === 2 ? 'md:col-span-2' : undefined}>
      <label htmlFor={id} className="admin-label">
        {field.label}
        {field.required && <span className="text-ts-red ml-1">*</span>}
      </label>

      {control()}

      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-[#ef6b6b]">
          {error}
        </p>
      ) : field.help ? (
        <p id={`${id}-help`} className="mt-1.5 text-xs text-ts-muted-2 leading-relaxed">
          {field.help}
        </p>
      ) : null}
    </div>
  );
}
