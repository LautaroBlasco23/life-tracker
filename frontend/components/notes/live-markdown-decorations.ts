import { EditorState, type Range } from '@codemirror/state';
import { Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

/**
 * Builds the decorations that style markdown live inside the editor
 * ("live preview", Obsidian-style):
 *
 * - syntax markers on the lines the cursor/selection touch are dimmed, so
 *   you always see the exact text you are editing;
 * - on inactive lines markers are hidden: `#`, `>`, `**`, inline backticks
 *   and link brackets collapse; `-`/`*` list markers are replaced by a
 *   bullet glyph. Ordered-list numbers stay visible (they are content).
 *
 * Styling classes are defined in `live-markdown-editor.tsx` via
 * `EditorView.theme`, so they stay colocated with the component.
 */

const markerDecoration = Decoration.mark({ class: 'cm-md-mark' });
const quoteDecoration = Decoration.line({ class: 'cm-md-quote' });

/* Zero-width widget replacements: an invisible span for hidden markers, a
 * bullet glyph for unordered-list markers. Widgets (instead of bare empty
 * replaces) keep the ranges clickable, so a click on one of them puts the
 * cursor on the line and makes the markers reappear. */
class HiddenMarkerWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-md-hidden';
    return span;
  }

  eq() {
    return true;
  }

  get visible() {
    return false;
  }
}

class BulletMarkerWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-md-bullet';
    span.textContent = '•';
    return span;
  }

  eq() {
    return true;
  }

  ignoreEvent() {
    return false;
  }
}

const hiddenMarkerDecoration = Decoration.replace({
  widget: new HiddenMarkerWidget(),
});
const bulletMarkerDecoration = Decoration.replace({
  widget: new BulletMarkerWidget(),
});

/* Renders `![alt](url)` (with its optional `{width=...}` attribute) inline
 * on inactive lines; the raw markdown stays reachable by double-clicking
 * the image (see isImageActive). The wrapper hosts the resize handle. */
class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string,
    private from: number,
    private to: number,
    private width?: number
  ) {
    super();
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-md-image-wrap';
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.loading = 'lazy';
    img.draggable = false;
    img.className = 'cm-md-image';
    if (this.width) img.style.width = `${this.width}px`;
    // Where this image's markdown lives in the doc — the editor's event
    // handlers read it to select/move/resize the span. Positions are valid
    // for the decoration set they were built with; doc changes rebuild
    // decorations, so the numbers never go stale on a live widget.
    wrap.dataset.imageFrom = String(this.from);
    wrap.dataset.imageTo = String(this.to);
    const handle = document.createElement('div');
    handle.className = 'cm-md-image-handle';
    wrap.appendChild(img);
    wrap.appendChild(handle);
    return wrap;
  }

  eq(other: WidgetType) {
    return (
      other instanceof ImageWidget &&
      other.src === this.src &&
      other.alt === this.alt &&
      other.from === this.from &&
      other.to === this.to &&
      other.width === this.width
    );
  }

  /* The editor's own handlers (live-markdown-editor.tsx) own every mouse
   * interaction on the image: click selects an edge, double-click reveals
   * the markdown, drag moves the image. CodeMirror must not also treat
   * these as plain editor events. */
  ignoreEvent() {
    return true;
  }
}

/** Parses `![alt](url)` (optionally `![alt](url){width=Npx}`) from an
 * Image node's text. The `{width=...}` attribute persists a user-set
 * render width; the mobile app does not render images today, so no
 * cross-platform parsing is needed yet — extend NoteMarkdownStyler when
 * it gains image support. */
export function parseImageMarkdown(text: string): {
  alt: string;
  url: string;
  width?: number;
} | null {
  const match =
    /^!\[([^\]]*)\]\((\S*)(?:\s+"[^"]*")?\)(?:\s*\{width=(\d+)px\})?$/.exec(
      text
    );
  if (!match) return null;
  return {
    alt: match[1],
    url: match[2],
    width: match[3] ? Number(match[3]) : undefined,
  };
}

/** Inverse of parseImageMarkdown: serializes an image (with an optional
 * render width) back to its markdown form. */
export function formatImageMarkdown(
  alt: string,
  url: string,
  width?: number
): string {
  const base = `![${alt}](${url})`;
  return width ? `${base}{width=${width}px}` : base;
}

/**
 * Dev-only (`make dev` fast lane): the backend generates note image URLs
 * against the S3_PUBLIC_URL web origin (default http://127.0.0.1:3000),
 * but the emulator rejects cross-site browser image fetches (real-S3 Fetch
 * Metadata semantics) and `next dev` may be browsed on any host — localhost,
 * 127.0.0.1, a LAN IP. Root-relative paths load through the dev server's
 * same-origin rewrite (next.config.mjs) on whatever host the app runs at.
 * Production builds keep the absolute URL: real S3 and the nginx container
 * lane serve those fine.
 */
export function normalizeNoteImageUrl(url: string): string {
  if (process.env.NODE_ENV !== 'development') return url;
  const match = /^https?:\/\/[^/]+(\/lifetracker-images\/.*)$/.exec(url);
  return match ? match[1] : url;
}

interface DocRange {
  from: number;
  to: number;
}

/** Lines overlapped by a non-empty selection are active; an empty cursor
 * activates exactly the line it sits on (not the one it abuts). */
function isActiveLine(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  return state.selection.ranges.some((r) => {
    if (r.empty) {
      return state.doc.lineAt(r.head).from === line.from;
    }
    return r.from <= line.to && r.to >= line.from;
  });
}

/** An image collapses to raw markdown only when the selection actually
 * touches its span — a cursor resting on either edge (where a click on the
 * rendered image lands) keeps it rendered. Selecting the span (double-click
 * on the image) reveals it, so the URL stays editable. Line-based activity
 * (`isActiveLine`) does not apply: a cursor anywhere else on the line is
 * never a reason to hide the image. */
function isImageActive(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => {
    if (r.empty) {
      return r.from > from && r.from < to;
    }
    return r.from < to && r.to > from;
  });
}

/** Hides a marker node plus an optional single trailing space, so `# Title`
 * renders flush-left as "Title" instead of "␣Title". */
function markerRangeEnd(state: EditorState, node: { to: number }): number {
  return state.doc.sliceString(node.to, node.to + 1) === ' '
    ? node.to + 1
    : node.to;
}

/**
 * Walks the markdown syntax tree over the given ranges and collects:
 * - dimmed marker decorations on active lines
 * - hidden/bullet marker replacements on inactive lines
 * - line decorations on blockquote lines
 * Heading/strong/emphasis/code typography comes from `HighlightStyle`
 * (`markdownHighlight` in the editor component), not from this function.
 */
export function buildMarkdownDecorations(
  state: EditorState,
  ranges: readonly DocRange[] = [{ from: 0, to: state.doc.length }]
): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === 'Blockquote') {
          let pos = node.from;
          while (pos <= node.to) {
            const line = state.doc.lineAt(pos);
            decorations.push(quoteDecoration.range(line.from));
            if (line.to >= node.to) break;
            pos = line.to + 1;
          }
        }

        // Render images inline unless the selection touches the image span
        // (see isImageActive). A persisted `{width=Npx}` attribute trails
        // the Image node in the syntax tree, so the decorated span extends
        // over it (otherwise the attribute shows as stray text). Returning
        // false skips the LinkMark children so no replace decorations
        // overlap ours.
        if (node.name === 'Image') {
          const lineEnd = state.doc.lineAt(node.to).to;
          const attr = /^\s*\{width=\d+px\}/.exec(
            state.sliceDoc(node.to, lineEnd)
          );
          const spanTo = attr ? node.to + attr[0].length : node.to;
          const parsed = parseImageMarkdown(state.sliceDoc(node.from, spanTo));
          if (
            parsed &&
            parsed.url &&
            !isImageActive(state, node.from, spanTo)
          ) {
            decorations.push(
              Decoration.replace({
                widget: new ImageWidget(
                  normalizeNoteImageUrl(parsed.url),
                  parsed.alt,
                  node.from,
                  spanTo,
                  parsed.width
                ),
              }).range(node.from, spanTo)
            );
            return false;
          }
          // Active (selection covers the span): descend into the LinkMark
          // children so the raw markdown gets its usual dimmed markers.
          if (isImageActive(state, node.from, spanTo)) return;
          // Unparsed and inactive (e.g. the upload placeholder): skip the
          // children like before, so no stray hidden-marker widgets appear.
          return false;
        }

        if (!node.name.endsWith('Mark')) return;

        if (isActiveLine(state, node.from)) {
          decorations.push(markerDecoration.range(node.from, node.to));
          return;
        }

        // Inactive line: hide or replace the marker.
        switch (node.name) {
          case 'HeaderMark':
          case 'QuoteMark':
          case 'EmphasisMark':
          case 'LinkMark':
            decorations.push(
              hiddenMarkerDecoration.range(
                node.from,
                markerRangeEnd(state, node)
              )
            );
            break;
          case 'ListMark': {
            const list = node.node.parent?.parent;
            if (list?.name === 'BulletList') {
              decorations.push(
                bulletMarkerDecoration.range(node.from, node.to)
              );
            } else {
              // Ordered lists: the number is content, keep it (dimmed).
              decorations.push(markerDecoration.range(node.from, node.to));
            }
            break;
          }
          case 'CodeMark':
            // Hide inline-code backticks; fenced-code fences stay visible
            // (collapsing a whole code block needs block-level widgets).
            if (node.node.parent?.name === 'InlineCode') {
              decorations.push(
                hiddenMarkerDecoration.range(node.from, node.to)
              );
            } else {
              decorations.push(markerDecoration.range(node.from, node.to));
            }
            break;
          default:
            decorations.push(markerDecoration.range(node.from, node.to));
        }
      },
    });
  }

  return Decoration.set(decorations, true);
}
