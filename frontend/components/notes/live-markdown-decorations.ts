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

/* Renders `![alt](url)` inline on inactive lines; the active line shows the
 * raw markdown so the URL stays editable. */
class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string
  ) {
    super();
  }

  toDOM() {
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.loading = 'lazy';
    img.className = 'cm-md-image';
    return img;
  }

  eq(other: WidgetType) {
    return (
      other instanceof ImageWidget &&
      other.src === this.src &&
      other.alt === this.alt
    );
  }

  ignoreEvent() {
    return false;
  }
}

/** Parses `![alt](url)` from an Image node's text. */
function parseImageMarkdown(text: string): { alt: string; url: string } | null {
  const match = /^!\[([^\]]*)\]\((\S*)(?:\s+"[^"]*")?\)$/.exec(text);
  if (!match) return null;
  return { alt: match[1], url: match[2] };
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

        // Render images inline on inactive lines (active line keeps the
        // raw markdown so the URL stays editable). Returning false skips
        // the LinkMark children so no replace decorations overlap ours.
        if (node.name === 'Image' && !isActiveLine(state, node.from)) {
          const parsed = parseImageMarkdown(state.sliceDoc(node.from, node.to));
          if (parsed && parsed.url) {
            decorations.push(
              Decoration.replace({
                widget: new ImageWidget(
                  normalizeNoteImageUrl(parsed.url),
                  parsed.alt
                ),
              }).range(node.from, node.to)
            );
          }
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
