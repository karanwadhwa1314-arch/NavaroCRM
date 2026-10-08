'use client';

import { useEffect, useRef } from 'react';
import { Bold, Italic, Link2, List, ListOrdered, Heading2, Quote, Eraser, UserRound } from 'lucide-react';
import { clsx } from 'clsx';

interface RichTextEditorProps {
  /** Initial HTML. The editor is uncontrolled after mount (re-key it to reset). */
  initialHtml: string;
  onChange: (html: string) => void;
  error?: boolean;
  id?: string;
  'aria-describedby'?: string;
}

/**
 * A deliberately small editor (no dependency): contentEditable + the browser's built-in commands,
 * limited to what the email can render. Pasted content is reduced to plain text, and the server
 * sanitises everything again on save, so this is a convenience layer, not a security boundary.
 */
export function RichTextEditor({ initialHtml, onChange, error, id, 'aria-describedby': describedBy }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    // Enter should start a <p>, not a <div>, so the stored HTML is clean paragraphs.
    document.execCommand('defaultParagraphSeparator', false, 'p');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    const el = ref.current;
    if (!el) return;
    // The first line starts life as a bare text node; give it a paragraph like every other line.
    if (el.firstChild?.nodeType === Node.TEXT_NODE && el.textContent) document.execCommand('formatBlock', false, 'p');
    onChange(el.innerHTML);
  }

  function run(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  }

  function addLink() {
    const url = window.prompt('Link address (https://…)');
    if (!url) return;
    const trimmed = url.trim();
    if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      window.alert('Links must start with https://, http:// or mailto:');
      return;
    }
    run('createLink', trimmed);
  }

  const tools: { label: string; icon: typeof Bold; action: () => void }[] = [
    { label: 'Bold', icon: Bold, action: () => run('bold') },
    { label: 'Italic', icon: Italic, action: () => run('italic') },
    { label: 'Heading', icon: Heading2, action: () => run('formatBlock', 'h2') },
    { label: 'Bulleted list', icon: List, action: () => run('insertUnorderedList') },
    { label: 'Numbered list', icon: ListOrdered, action: () => run('insertOrderedList') },
    { label: 'Quote', icon: Quote, action: () => run('formatBlock', 'blockquote') },
    { label: 'Add link', icon: Link2, action: addLink },
    { label: 'Insert first name', icon: UserRound, action: () => run('insertText', '{{first_name}}') },
    { label: 'Clear formatting', icon: Eraser, action: () => { run('removeFormat'); run('formatBlock', 'p'); } },
  ];

  return (
    <div className={clsx('overflow-hidden rounded-control border bg-white', error ? 'border-danger' : 'border-navaro-line focus-within:border-navaro-green focus-within:ring-2 focus-within:ring-navaro-green/20')}>
      <div className="flex flex-wrap gap-1 border-b border-navaro-line bg-navaro-heath p-1.5" role="toolbar" aria-label="Formatting">
        {tools.map(({ label, icon: Icon, action }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            // mousedown (not click) with preventDefault keeps the text selection while the button is used
            onMouseDown={(e) => {
              e.preventDefault();
              action();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                action();
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-control text-navaro-green hover:bg-navaro-hover"
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        id={id}
        aria-describedby={describedBy}
        aria-label="Email content"
        aria-multiline="true"
        role="textbox"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Write your email…"
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
        className={clsx(
          'min-h-[220px] max-h-[360px] overflow-y-auto px-4 py-3 text-body text-navaro-green focus:outline-none',
          'empty:before:text-navaro-muted empty:before:content-[attr(data-placeholder)]',
          '[&_p]:mb-3 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-h2 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6',
          '[&_blockquote]:mb-3 [&_blockquote]:border-l-4 [&_blockquote]:border-navaro-turquoise [&_blockquote]:pl-4 [&_a]:underline'
        )}
      />
    </div>
  );
}
