import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import {
  buildMarkdownDecorations,
  normalizeNoteImageUrl,
} from './live-markdown-decorations';

interface FoundDecoration {
  from: number;
  to: number;
  deco: {
    attrs?: { class?: string };
    spec?: { class?: string };
    widget?: unknown;
  };
}

function collect(
  doc: string,
  sel?: number | EditorSelection | { anchor: number; head?: number }
): FoundDecoration[] {
  const state = EditorState.create({
    doc,
    ...(sel === undefined
      ? {}
      : { selection: typeof sel === 'number' ? { anchor: sel } : sel }),
    extensions: [markdown()],
  });
  const set = buildMarkdownDecorations(state);
  const found: FoundDecoration[] = [];
  set.between(0, doc.length, (from, to, deco) => {
    found.push({
      from,
      to,
      deco: deco as FoundDecoration['deco'],
    });
  });
  return found;
}

/* Decoration.mark stores its class under `attrs.class`; Decoration.line
 * (no DOM mark) keeps it under `spec.class`. */
function className(f: FoundDecoration): string | undefined {
  return f.deco.attrs?.class ?? f.deco.spec?.class;
}

/* Widget replacements (hidden markers, bullets) carry no class fields; their
 * identity comes from the DOM their WidgetType renders. */
function widgetEl(f: FoundDecoration): HTMLElement | undefined {
  const widget = f.deco.widget as { toDOM?: () => HTMLElement } | undefined;
  if (!widget?.toDOM) return undefined;
  return (widget as unknown as { toDOM: () => HTMLElement }).toDOM();
}

describe('buildMarkdownDecorations', () => {
  describe('active lines (default cursor at 0)', () => {
    it('dims the heading marker of ATX headings', () => {
      const marker = collect('# Title').find(
        (f) => className(f) === 'cm-md-mark'
      );
      expect(marker?.from).toBe(0);
      expect(marker?.to).toBe(1);
    });

    it('dims deeper heading markers (### subsection)', () => {
      const marker = collect('### subsection').find(
        (f) => className(f) === 'cm-md-mark'
      );
      expect(marker?.from).toBe(0);
      expect(marker?.to).toBe(3);
    });

    it('dims bullet list markers', () => {
      const doc = '- item';
      const markers = collect(doc).filter(
        (f) => className(f) === 'cm-md-mark' && doc[f.from] === '-'
      );
      expect(markers.map((m) => m.from)).toEqual([0]);
    });

    it('dims ordered list markers', () => {
      const found = collect('1. numbered');
      const marker = found.find((f) => className(f) === 'cm-md-mark');
      expect(marker?.from).toBe(0);
      expect(marker?.to).toBe(2); // "1."
    });

    it('dims every emphasis marker of bold and italic text', () => {
      const doc = '**bold** *italic*';
      const markers = collect(doc).filter((f) => className(f) === 'cm-md-mark');
      expect(markers.map((m) => [m.from, m.to])).toEqual([
        [0, 2],
        [6, 8],
        [9, 10],
        [16, 17],
      ]);
    });

    it('dims blockquote and inline-code markers on one line', () => {
      const doc = '> quoted `code`';
      const found = collect(doc);
      const quoteMark = found.find(
        (f) => className(f) === 'cm-md-mark' && doc[f.from] === '>'
      );
      expect(quoteMark?.to).toBe(1);
      const codeMarks = found.filter(
        (f) => className(f) === 'cm-md-mark' && doc[f.from] === '`'
      );
      expect(codeMarks).toHaveLength(2);
    });
  });

  describe('inactive lines (cursor elsewhere)', () => {
    it('hides heading markers, including the trailing space', () => {
      const found = collect('# Title\n\nbody text', 17);
      expect(found.filter((f) => className(f) === 'cm-md-mark')).toEqual([]);
      const hidden = found.find((f) => f.deco.widget && f.from === 0);
      expect(hidden?.to).toBe(2); // "#" + " "
    });

    it('replaces unordered list markers with a bullet glyph', () => {
      const doc = '- item\n- other\n\nmore text';
      const found = collect(doc, 18);
      const bullets = found.filter(
        (f) => widgetEl(f)?.className === 'cm-md-bullet'
      );
      expect(bullets.map((b) => [b.from, b.to])).toEqual([
        [0, 1],
        [7, 8],
      ]);
      expect(found.filter((f) => className(f) === 'cm-md-mark')).toEqual([]);
    });

    it('keeps ordered list markers visible (they are content)', () => {
      const found = collect('1. numbered\n\nmore text', 13);
      const marker = found.find((f) => className(f) === 'cm-md-mark');
      expect(marker?.from).toBe(0);
      expect(marker?.to).toBe(2);
    });

    it('hides quote, emphasis and inline-code markers', () => {
      const doc = '> quoted\n`code`\n**bold**\n\nlast line';
      const found = collect(doc, 28);
      expect(found.filter((f) => className(f) === 'cm-md-mark')).toEqual([]);
      const hiddenRanges = found
        .filter((f) => f.deco.widget)
        .map((f) => [f.from, f.to])
        .sort((a, b) => a[0] - b[0]);
      expect(hiddenRanges).toEqual([
        [0, 2], // ">" + " "
        [9, 10], // first backtick
        [14, 15], // second backtick
        [16, 18], // **
        [22, 24], // **
      ]);
    });

    it('keeps fenced-code fences visible on inactive lines', () => {
      const doc = '```\ncode line\n```\n\nmore text';
      const found = collect(doc, 18);
      const fences = found.filter(
        (f) => className(f) === 'cm-md-mark' && doc[f.from] === '`'
      );
      expect(fences).toHaveLength(2);
    });

    it('renders images as widget replacements on inactive lines', () => {
      const doc = 'before\n\n![alt text](http://x/y.png)\n\nafter';
      const found = collect(doc, 40); // cursor on the "after" line
      const imageStart = doc.indexOf('![alt text]');
      const imageEnd = imageStart + '![alt text](http://x/y.png)'.length;
      const image = found.find(
        (f) => f.deco.widget && f.from === imageStart && f.to === imageEnd
      );
      expect(image).toBeDefined();
    });

    it('keeps the raw image markdown visible when the selection covers the image', () => {
      // Double-clicking the image selects its whole span, which reveals the
      // markdown so the URL stays editable.
      const doc = '![alt](http://x/y.png)';
      const found = collect(doc, { anchor: 0, head: doc.length });
      expect(found.some((f) => f.deco.widget)).toBe(false);
      const marks = found.filter((f) => className(f) === 'cm-md-mark');
      expect(marks.length).toBeGreaterThan(0); // ![ ]( ) dimmed
    });

    it('keeps the image rendered when the cursor rests on the span edge', () => {
      // A click on the widget lands at one of the span edges — the image
      // must stay rendered instead of flashing to raw markdown.
      const doc = 'before\n\n![alt text](http://x/y.png)\n\nafter';
      const from = doc.indexOf('![alt text]');
      const to = from + '![alt text](http://x/y.png)'.length;
      expect(collect(doc, from).some((f) => f.deco.widget)).toBe(true);
      expect(collect(doc, to).some((f) => f.deco.widget)).toBe(true);
    });

    it('keeps the image rendered when the cursor shares the line but sits outside the span', () => {
      const doc = '![alt](http://x/y.png) trailing text';
      const found = collect(doc, doc.length);
      expect(found.some((f) => f.deco.widget)).toBe(true);
    });

    it('does not render a widget for images without a URL', () => {
      const doc = 'before\n\n![Uploading image...]()\n\nafter';
      const found = collect(doc, 38);
      expect(found.some((f) => f.deco.widget)).toBe(false);
    });
  });

  it('marks blockquote lines with the quote line decoration', () => {
    const doc = '> line one\n> line two\n\nnormal';
    const found = collect(doc);
    const quoteLines = found.filter((f) => className(f) === 'cm-md-quote');
    expect(quoteLines.map((f) => f.from)).toEqual([0, 11]);
  });

  it('returns no decorations for plain text', () => {
    const found = collect('just words\nmore words');
    expect(found).toHaveLength(0);
  });
});

describe('normalizeNoteImageUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('strips the URL origin in development so next dev serves it same-origin', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(
      normalizeNoteImageUrl(
        'http://127.0.0.1:3000/lifetracker-images/notes/1/x.png'
      )
    ).toBe('/lifetracker-images/notes/1/x.png');
    expect(
      normalizeNoteImageUrl(
        'https://bucket.s3.us-east-1.amazonaws.com/lifetracker-images/notes/1/x.png'
      )
    ).toBe('/lifetracker-images/notes/1/x.png');
  });

  it('leaves root-relative and foreign-path URLs untouched', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(normalizeNoteImageUrl('/lifetracker-images/notes/1/x.png')).toBe(
      '/lifetracker-images/notes/1/x.png'
    );
    expect(normalizeNoteImageUrl('https://x.com/other/y.png')).toBe(
      'https://x.com/other/y.png'
    );
  });

  it('keeps absolute URLs outside development', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(
      normalizeNoteImageUrl(
        'http://127.0.0.1:3000/lifetracker-images/notes/1/x.png'
      )
    ).toBe('http://127.0.0.1:3000/lifetracker-images/notes/1/x.png');
  });
});
