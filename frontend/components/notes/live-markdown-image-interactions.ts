import { EditorSelection } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  formatImageMarkdown,
  parseImageMarkdown,
} from './live-markdown-decorations';

/* Mouse interactions for rendered note images (`.cm-md-image-wrap` widgets,
 * ignoreEvent -> true so CodeMirror never treats these as editor events):
 *
 * - click: place the cursor on the nearest edge of the image's markdown
 *   span (the image stays rendered — see isImageActive in
 *   live-markdown-decorations.ts).
 * - drag: move the image to the drop position (anywhere in the doc); the
 *   image is cloned into a floating ghost while dragging.
 * - double-click: select the whole span, which reveals the raw markdown so
 *   the URL stays editable. Clicking elsewhere re-renders the image.
 * - drag the corner handle: resize the image; on release the width is
 *   persisted into the markdown as `![alt](url){width=Npx}`.
 */

const DRAG_THRESHOLD_PX = 5;
const MIN_IMAGE_WIDTH_PX = 64;

interface ImageSpan {
  from: number;
  to: number;
  img: HTMLImageElement;
}

function imageSpanFromEvent(event: Event): ImageSpan | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const wrap = target.closest('.cm-md-image-wrap');
  if (!(wrap instanceof HTMLElement)) return null;
  const img = wrap.querySelector('.cm-md-image');
  if (!(img instanceof HTMLImageElement)) return null;
  const from = Number(wrap.dataset.imageFrom);
  const to = Number(wrap.dataset.imageTo);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return null;
  }
  return { from, to, img };
}

function startImageDrag(
  view: EditorView,
  down: MouseEvent,
  span: ImageSpan
): void {
  const { from, to, img } = span;
  const text = view.state.sliceDoc(from, to);
  const startX = down.clientX;
  const startY = down.clientY;
  let dragging = false;
  let ghost: HTMLImageElement | null = null;

  const onMove = (event: MouseEvent) => {
    if (!dragging) {
      if (
        Math.hypot(event.clientX - startX, event.clientY - startY) <
        DRAG_THRESHOLD_PX
      ) {
        return;
      }
      dragging = true;
      const rect = img.getBoundingClientRect();
      ghost = img.cloneNode(false) as HTMLImageElement;
      ghost.style.position = 'fixed';
      ghost.style.pointerEvents = 'none';
      ghost.style.opacity = '0.75';
      ghost.style.zIndex = '50';
      ghost.style.margin = '0';
      ghost.style.width = `${rect.width}px`;
      document.body.appendChild(ghost);
      document.body.style.userSelect = 'none';
    }
    if (ghost) {
      const rect = img.getBoundingClientRect();
      ghost.style.left = `${event.clientX - rect.width / 2}px`;
      ghost.style.top = `${event.clientY - rect.height / 2}px`;
    }
  };

  const onUp = (event: MouseEvent) => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
    ghost?.remove();
    ghost = null;

    if (!dragging) {
      // Plain click: put the cursor on the nearest edge of the span.
      const hit = view.posAtCoords({ x: event.clientX, y: event.clientY });
      const pos = hit ?? (from + to) / 2;
      const edge = pos <= (from + to) / 2 ? from : to;
      view.dispatch({ selection: EditorSelection.cursor(edge) });
      view.focus();
      return;
    }

    const hit = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (hit === null) return;
    // Dropped back onto its own span: no-op.
    if (hit > from && hit < to) return;
    if (hit === from || hit === to) return;
    // Changes are position-adjusted: removing the span first shifts every
    // position after it, so the insertion point compensates when the drop
    // lands after the source.
    const insertAt = hit > to ? hit - (to - from) : hit;
    view.dispatch({
      changes: [
        { from, to, insert: '' },
        { from: insertAt, to: insertAt, insert: text },
      ],
      selection: { anchor: insertAt + text.length },
    });
    view.focus();
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function startImageResize(
  view: EditorView,
  down: MouseEvent,
  span: ImageSpan
): void {
  const { from, to, img } = span;
  const startX = down.clientX;
  const startWidth = img.getBoundingClientRect().width;
  // The editor content area is the real upper bound — the wrapper is
  // `width: fit-content`, so its own clientWidth would follow the image.
  const maxWidth = view.contentDOM.clientWidth || startWidth * 2;
  let cancelled = false;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') cancelled = true;
  };

  const onMove = (event: MouseEvent) => {
    if (cancelled) return;
    const width = Math.min(
      maxWidth,
      Math.max(
        MIN_IMAGE_WIDTH_PX,
        Math.round(startWidth + event.clientX - startX)
      )
    );
    img.style.width = `${width}px`;
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKeyDown);
    const width = parseFloat(img.style.width);
    img.style.width = '';
    if (cancelled || !Number.isFinite(width)) return;

    const parsed = parseImageMarkdown(view.state.sliceDoc(from, to));
    if (!parsed) return;
    // Rounding to whole pixels keeps the stored markdown stable.
    const persisted = Math.round(width);
    view.dispatch({
      changes: {
        from,
        to,
        insert: formatImageMarkdown(parsed.alt, parsed.url, persisted),
      },
      selection: { anchor: from },
    });
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKeyDown);
}

export const imageInteractions: Extension = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!(event instanceof MouseEvent)) return false;
    const span = imageSpanFromEvent(event);
    if (!span) return false;
    event.preventDefault();
    if (
      event.target instanceof Element &&
      event.target.closest('.cm-md-image-handle')
    ) {
      startImageResize(view, event, span);
    } else {
      startImageDrag(view, event, span);
    }
    return true;
  },
  dblclick(event, view) {
    const span = imageSpanFromEvent(event);
    if (!span) return false;
    event.preventDefault();
    view.dispatch({
      selection: EditorSelection.range(span.from, span.to),
    });
    view.focus();
    return true;
  },
});
