'use client';

import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import {
  DecorationSet,
  EditorView,
  ViewPlugin,
  keymap,
  placeholder,
  type ViewUpdate,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';
import { buildMarkdownDecorations } from './live-markdown-decorations';
import { imageInteractions } from './live-markdown-image-interactions';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/toast';

interface LiveMarkdownEditorProps {
  /** Controlled markdown text (same contract as the Textarea it replaces). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Uploads a pasted/dropped image and resolves to its public URL. */
  uploadImage?: (file: File) => Promise<string>;
  /** Alt text shown in the markdown while the upload is in flight. */
  imageUploadingAlt?: string;
  /** Alt text used for the inserted image markdown. */
  imageAlt?: string;
  /** Toast title when an upload fails. */
  imageUploadFailedLabel?: string;
}

/** Keep in sync with the backend's image size cap (imagestore client). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface ImageProps extends Pick<
  LiveMarkdownEditorProps,
  'uploadImage' | 'imageUploadingAlt' | 'imageAlt' | 'imageUploadFailedLabel'
> {}

function collectImageFiles(dt: DataTransfer | null): File[] {
  return Array.from(dt?.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/** Replaces the first exact occurrence of `needle` (a unique uploading
 * placeholder) with `replacement`. Positions are plain offsets because
 * `indexOf` over the doc string maps 1:1 to document offsets. */
function replaceOnce(view: EditorView, needle: string, replacement: string) {
  const doc = view.state.doc.toString();
  const at = doc.indexOf(needle);
  if (at === -1) return;
  view.dispatch({
    changes: { from: at, to: at + needle.length, insert: replacement },
  });
}

/* Intercept image pastes/drops: insert an uploading placeholder at the
 * target position immediately, then swap it for the final markdown (or
 * remove it + toast on failure). Returns true when we handled the event. */
function insertImages(
  view: EditorView,
  files: File[],
  at: number,
  props: ImageProps
): boolean {
  const upload = props.uploadImage;
  if (!upload || files.length === 0) return false;
  const failureTitle = props.imageUploadFailedLabel ?? 'Failed to upload image';

  let insertAt = at;
  files.forEach((file, index) => {
    const suffix = files.length > 1 ? ` (${index + 1})` : '';
    const placeholderMd = `![${props.imageUploadingAlt ?? 'Uploading image...'}${suffix}]()`;

    if (file.size > MAX_IMAGE_BYTES) {
      showToast({
        title: failureTitle,
        description: `${file.name}: > 10MB`,
        variant: 'destructive',
      });
      return;
    }
    view.dispatch({ changes: { from: insertAt, insert: placeholderMd } });
    insertAt += placeholderMd.length;

    void upload(file)
      .then((url) => {
        replaceOnce(
          view,
          placeholderMd,
          `![${props.imageAlt ?? 'Pasted image'}](${url})`
        );
      })
      .catch((error) => {
        console.error('Image upload failed:', error);
        replaceOnce(view, placeholderMd, '');
        showToast({ title: failureTitle, variant: 'destructive' });
      });
  });
  return true;
}

/* Guard for paste/drop image interception: only take over the event when
 * there is something to upload and an uploader is wired; otherwise let the
 * normal text paste / CM drop behavior run. */
function shouldHandleImages(props: ImageProps, dt: DataTransfer | null) {
  return Boolean(props.uploadImage) && collectImageFiles(dt).length > 0;
}

/* Typography scale mirrors the Tailwind `prose` preview (MarkdownView) so
 * switching between edit and preview doesn't visually jump. Colors come from
 * the CSS tokens in globals.css, so dark mode follows automatically. */
const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-md-h1' },
  { tag: tags.heading2, class: 'cm-md-h2' },
  { tag: tags.heading3, class: 'cm-md-h3' },
  { tag: tags.heading4, class: 'cm-md-h4' },
  { tag: tags.heading5, class: 'cm-md-h5' },
  { tag: tags.heading6, class: 'cm-md-h6' },
  { tag: tags.strong, class: 'cm-md-strong' },
  { tag: tags.emphasis, class: 'cm-md-em' },
  { tag: tags.monospace, class: 'cm-md-code' },
  { tag: tags.link, class: 'cm-md-link' },
]);

const markdownTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--foreground)',
    backgroundColor: 'transparent',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflowY: 'auto',
    fontFamily: 'var(--font-geist-sans), sans-serif',
  },
  '.cm-content': {
    padding: '2px 0',
    fontSize: '1rem',
    lineHeight: '1.625',
    caretColor: 'var(--primary)',
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--primary)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'color-mix(in oklab, var(--primary) 25%, transparent)' },
  '.cm-placeholder': { color: 'var(--text-muted)' },

  '.cm-md-h1': { fontSize: '1.75em', fontWeight: '700', lineHeight: '1.25' },
  '.cm-md-h2': { fontSize: '1.5em', fontWeight: '700', lineHeight: '1.3' },
  '.cm-md-h3': { fontSize: '1.25em', fontWeight: '600' },
  '.cm-md-h4': { fontSize: '1.125em', fontWeight: '600' },
  '.cm-md-h5': { fontSize: '1em', fontWeight: '600' },
  '.cm-md-h6': {
    fontSize: '0.95em',
    fontWeight: '600',
    color: 'var(--text-muted)',
  },
  '.cm-md-strong': { fontWeight: '700' },
  '.cm-md-em': { fontStyle: 'italic' },
  '.cm-md-code': {
    fontFamily: 'var(--font-geist-mono), monospace',
    fontSize: '0.9em',
    backgroundColor: 'var(--muted)',
    borderRadius: '0.25rem',
    padding: '0.1em 0.3em',
  },
  '.cm-md-link': {
    color: 'var(--primary)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  /* Dimmed syntax markers on active lines (`#`, `-`, `**`, ...) */
  '.cm-md-mark': {
    color: 'color-mix(in oklab, var(--text-muted) 50%, transparent)',
  },
  /* Rendered bullet replacing `-` on inactive list lines */
  '.cm-md-bullet': {
    color: 'color-mix(in oklab, var(--text-muted) 70%, transparent)',
    fontWeight: '700',
  },
  /* Rendered image inside the editor (inactive lines) */
  '.cm-md-image': {
    maxWidth: '100%',
    display: 'block',
    margin: '0.25rem 0',
    borderRadius: '0.5rem',
    border: '1px solid var(--border)',
    cursor: 'grab',
  },
  /* Blockquote lines */
  '.cm-md-quote': {
    borderLeft: '3px solid var(--border)',
    paddingLeft: '0.75em',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
});

/* Rebuilds decorations on doc, selection and viewport changes: the
 * selection decides which lines show dimmed markers vs rendered output. */
const markdownDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildMarkdownDecorations(
        view.state,
        view.visibleRanges
      );
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildMarkdownDecorations(
          update.state,
          update.view.visibleRanges
        );
      }
    }
  },
  { decorations: (v) => v.decorations }
);

export function LiveMarkdownEditor({
  value,
  onChange,
  placeholder: placeholderText,
  ariaLabel = 'Note content',
  className,
  uploadImage,
  imageUploadingAlt,
  imageAlt,
  imageUploadFailedLabel,
}: LiveMarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const imagePropsRef = useRef<ImageProps>({
    uploadImage,
    imageUploadingAlt,
    imageAlt,
    imageUploadFailedLabel,
  });

  useEffect(() => {
    onChangeRef.current = onChange;
    imagePropsRef.current = {
      uploadImage,
      imageUploadingAlt,
      imageAlt,
      imageUploadFailedLabel,
    };
  }, [
    onChange,
    uploadImage,
    imageUploadingAlt,
    imageAlt,
    imageUploadFailedLabel,
  ]);

  useEffect(() => {
    const view = new EditorView({
      parent: containerRef.current!,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          EditorView.lineWrapping,
          markdown(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          history(),
          placeholder(placeholderText ?? ''),
          imageInteractions,
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
          /* Image paste/drop: read the latest props through the ref so the
           * extension never needs rebuilding. */
          EditorView.domEventHandlers({
            paste: (event, view) => {
              if (
                !shouldHandleImages(imagePropsRef.current, event.clipboardData)
              ) {
                return false;
              }
              event.preventDefault();
              return insertImages(
                view,
                collectImageFiles(event.clipboardData),
                view.state.selection.main.head,
                imagePropsRef.current
              );
            },
            drop: (event, view) => {
              if (
                !shouldHandleImages(imagePropsRef.current, event.dataTransfer)
              ) {
                return false;
              }
              event.preventDefault();
              const pos =
                view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
                view.state.selection.main.head;
              return insertImages(
                view,
                collectImageFiles(event.dataTransfer),
                pos,
                imagePropsRef.current
              );
            },
          }),
          markdownTheme,
          syntaxHighlighting(markdownHighlight),
          markdownDecorations,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; value changes flow through the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Sync external value changes into the editor. The equality check is the
   * echo guard: keystrokes already produced by the editor must not be
   * dispatched back (a no-op dispatch would still create undo entries). */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full h-full overflow-hidden', className)}
    />
  );
}
