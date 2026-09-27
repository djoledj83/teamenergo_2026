'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Icon from '@/components/ui/AppIcon';

/**
 * Rich text for body copy.
 *
 * Stores HTML rather than TipTap's JSON: the public site renders it directly,
 * and HTML stays readable and portable if the editor is ever replaced.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const editor = useEditor({
    // Rendering on the server produces markup React then has to reconcile,
    // which logs a hydration mismatch. The editor is client-only by nature.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Code blocks are noise in marketing copy.
        codeBlock: false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Unesite tekst…' }),
    ],
    content: value,
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      // TipTap represents "empty" as <p></p>; normalise so a blank field
      // saves as null rather than an empty paragraph.
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Keep the editor in sync when the value changes from outside — switching
  // language tabs swaps the content under the same editor instance.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '<p></p>';
    if (current !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return <div className="admin-input h-48 animate-pulse" aria-hidden="true" />;
  }

  const button = (
    label: string,
    icon: string,
    action: () => void,
    active: boolean,
  ) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={action}
      disabled={disabled}
      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
        active ? 'bg-ts-surface-2 text-ts-fg' : 'text-ts-muted hover:text-ts-fg'
      }`}
    >
      <Icon name={icon} size={16} />
    </button>
  );

  return (
    <div className="admin-editor rounded-xl border border-ts-border bg-ts-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-ts-border">
        {button('Podebljano', 'BoldIcon', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {button('Kurziv', 'ItalicIcon', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        <span className="w-px h-5 bg-ts-border mx-1" />
        {button('Naslov 2', 'H2Icon', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
        {button('Naslov 3', 'H3Icon', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
        <span className="w-px h-5 bg-ts-border mx-1" />
        {button('Lista', 'ListBulletIcon', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {button('Numerisana lista', 'NumberedListIcon', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {button('Citat', 'ChatBubbleBottomCenterTextIcon', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
        <span className="w-px h-5 bg-ts-border mx-1" />
        {button(
          'Link',
          'LinkIcon',
          () => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const url = window.prompt('Adresa linka');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          },
          editor.isActive('link'),
        )}
      </div>

      <div className="admin-prose px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
