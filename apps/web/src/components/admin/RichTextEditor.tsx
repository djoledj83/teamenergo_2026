'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
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

/**
 * Rewrites the paragraph under the cursor as one paragraph per line.
 *
 * A list is made of block nodes, so "bullet the selected line" is only
 * possible if that line IS a block. Text that arrived from Word or an email
 * is usually a single paragraph with hard breaks inside it — it looks like
 * several lines and is one block — so selecting a phrase and pressing
 * "Lista" bulleted the entire text. Nothing was broken; there was simply one
 * block to act on.
 *
 * Splitting at the hard breaks first gives the list something to bite on, and
 * the selection is carried over to the same words so the list command that
 * follows affects exactly the lines the author had highlighted.
 *
 * Returns null when there is nothing to do: a selection spanning several
 * blocks (already one block per line), or a paragraph with no breaks in it.
 */
function splitHardBreaks(state: EditorState): Transaction | null {
  const { $from, $to, from, to } = state.selection;
  if (!$from.sameParent($to)) return null;

  const paragraph = state.schema.nodes.paragraph;
  const block = $from.parent;
  if (!paragraph || block.type !== paragraph) return null;

  // Group the inline content into lines, recording each line's offsets
  // within the block so the selection can be mapped onto the result.
  const lines: Array<{ nodes: ProseMirrorNode[]; start: number; end: number }> = [];
  let nodes: ProseMirrorNode[] = [];
  let start = 0;
  block.content.forEach((child, offset) => {
    if (child.type.name === 'hardBreak') {
      lines.push({ nodes, start, end: offset });
      nodes = [];
      start = offset + child.nodeSize;
    } else {
      nodes.push(child);
    }
  });
  lines.push({ nodes, start, end: block.content.size });

  // Blank lines become spacing, not empty paragraphs.
  const kept = lines.filter((line) => line.nodes.length > 0);
  if (kept.length < 2) return null;

  const contentStart = $from.start();
  const lineAt = (offset: number) => {
    const index = kept.findIndex((line) => offset <= line.end);
    return index === -1 ? kept.length - 1 : index;
  };
  const firstLine = lineAt(from - contentStart);
  const lastLine = Math.max(firstLine, lineAt(to - contentStart));

  const paragraphs = kept.map((line) => paragraph.create(null, Fragment.fromArray(line.nodes)));
  const tr = state.tr.replaceWith(
    $from.before(),
    $from.after(),
    Fragment.fromArray(paragraphs),
  );

  let position = $from.before();
  const starts = paragraphs.map((node) => {
    const at = position;
    position += node.nodeSize;
    return at;
  });

  return tr.setSelection(
    TextSelection.create(
      tr.doc,
      starts[firstLine] + 1,
      starts[lastLine] + paragraphs[lastLine].nodeSize - 1,
    ),
  );
}

/** Runs a list command, splitting hard breaks into paragraphs first. */
function asList(editor: Editor, run: () => void) {
  const tr = splitHardBreaks(editor.state);
  if (tr) editor.view.dispatch(tr);
  run();
}
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

    editorProps: {
      /**
       * Pasted plain text becomes one paragraph per line.
       *
       * ProseMirror's default turns a single newline into a hard break, so a
       * block of text pasted from Word or an email arrives as ONE paragraph
       * containing <br> after <br>. That looks right and behaves wrongly: a
       * bullet list applies to whole block nodes, so selecting a phrase in
       * that paragraph and pressing "Lista" turns the entire thing into one
       * bullet — the whole text, not the selection. Nothing is broken; there
       * is simply only one block to act on.
       *
       * Splitting on paste gives each line its own paragraph, which is what
       * the author meant by pressing Enter in the first place, and bullets
       * then apply line by line.
       *
       * Real HTML on the clipboard is left alone — it already carries its own
       * block structure, and second-guessing it would lose formatting.
       */
      handlePaste(view, event) {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        if (clipboard.getData('text/html')) return false;

        const text = clipboard.getData('text/plain');
        if (!text || !text.includes('\n')) return false;

        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (lines.length < 2) return false;

        const { schema, tr } = view.state;
        const paragraph = schema.nodes.paragraph;
        if (!paragraph) return false;

        const fragment = Fragment.fromArray(
          lines.map((line) => paragraph.create(null, schema.text(line))),
        );
        view.dispatch(tr.replaceSelection(new Slice(fragment, 0, 0)).scrollIntoView());
        return true;
      },
    },

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
        {button(
          'Lista',
          'ListBulletIcon',
          () => asList(editor, () => editor.chain().focus().toggleBulletList().run()),
          editor.isActive('bulletList'),
        )}
        {button(
          'Numerisana lista',
          'NumberedListIcon',
          () => asList(editor, () => editor.chain().focus().toggleOrderedList().run()),
          editor.isActive('orderedList'),
        )}
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
