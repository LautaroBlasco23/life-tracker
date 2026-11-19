import { EditorSelection, EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/* Mouse interactions for rendered note images (`.cm-md-image` widgets,
 * ignoreEvent -> true so CodeMirror never treats these as editor events):
 *
 * - click: place the cursor on the nearest edge of the image's markdown
 *   span (the image stays rendered — see isImageActive in
 *   live-markdown-decorations.ts).
 * - drag: move the image to the drop position (anywhere in the doc); the
 *   widget is cloned into a floating ghost while dragging.
 * - double-click: select the whole span, which reveals the raw markdown so
 *   the URL stays editable. Clicking elsewhere re-renders the image.
 */

const DRAG_THRESHOLD_PX = 5;

interface ImageSpan {
  from: number;
  to: number;
  img: HTMLImageElement;
}

function imageSpanFromEvent(event: Event): ImageSpan | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const img = target.closest('.cm-md-image');
  if (!(img instanceof HTMLImageElement)) return null;
  const from = Number(img.dataset.imageFrom);
  const to = Number(img.dataset.imageTo);
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
      ghost.style.left = `${event.clientX - rect.width / 2}px`;
      ghost.style.top = `${event.clientY - rect.height / 2}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.pointerEvents = 'none';
      ghost.style.opacity = '0.75';
      ghost.style.zIndex = '50';
      ghost.style.margin = '0';
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

export const imageInteractions: Extension = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!(event instanceof MouseEvent)) return false;
    const span = imageSpanFromEvent(event);
    if (!span) return false;
    event.preventDefault();
    startImageDrag(view, event, span);
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
