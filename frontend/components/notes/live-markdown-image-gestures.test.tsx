import { render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveMarkdownEditor } from './live-markdown-editor';

/**
 * Mouse gestures on rendered note images (`live-markdown-image-gestures`).
 * The widget's `ignoreEvent()` keeps CodeMirror's own handler chains away, so
 * the gestures are native listeners on `view.dom`; these tests drive them
 * through DOM events on the real editor.
 */
const IMAGE = '![shot](https://cdn.test/a.png)';

function mount(value: string) {
  const { container, unmount } = render(
    <LiveMarkdownEditor value={value} onChange={vi.fn()} />
  );
  const editorDom = container.querySelector('.cm-editor') as HTMLElement;
  const view = EditorView.findFromDOM(editorDom)!;
  const wrap = container.querySelector('.cm-md-image-wrap') as HTMLElement;
  const img = wrap.querySelector('.cm-md-image') as HTMLImageElement;
  const handle = wrap.querySelector('.cm-md-image-handle') as HTMLElement;
  return { container, unmount, view, wrap, img, handle };
}

/** Positions recorded by the widget for the image span it renders. */
function span(wrap: HTMLElement) {
  return {
    from: Number(wrap.dataset.imageFrom),
    to: Number(wrap.dataset.imageTo),
  };
}

function mouse(
  type: string,
  target: EventTarget,
  init: MouseEventInit = {}
): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.style.userSelect = '';
});

describe('image interactions', () => {
  it('renders the image widget for an inactive image line', () => {
    const { img, wrap, unmount } = mount(IMAGE);
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.png');
    expect(span(wrap)).toEqual({ from: 0, to: IMAGE.length });
    unmount();
  });

  it('a plain click puts the cursor on the nearest span edge', () => {
    const { view, img, unmount } = mount(IMAGE);
    // Click on the left half of the span -> cursor at `from`.
    vi.spyOn(view, 'posAtCoords').mockReturnValue(IMAGE.length / 2 - 1);
    mouse('mousedown', img, { clientX: 10, clientY: 10 });
    mouse('mouseup', window, { clientX: 10, clientY: 10 });

    expect(view.state.selection.main.head).toBe(0);
    expect(view.hasFocus).toBe(true);
    unmount();
  });

  it('a click on the right half lands on the span end', () => {
    const { view, img, unmount } = mount(IMAGE);
    vi.spyOn(view, 'posAtCoords').mockReturnValue(IMAGE.length / 2 + 1);
    mouse('mousedown', img, { clientX: 10, clientY: 10 });
    mouse('mouseup', window, { clientX: 10, clientY: 10 });

    expect(view.state.selection.main.head).toBe(IMAGE.length);
    unmount();
  });

  it('double-click selects the whole image markdown', () => {
    const { view, img, unmount } = mount(IMAGE);
    mouse('dblclick', img);

    const selection = view.state.selection.main;
    expect(selection.from).toBe(0);
    expect(selection.to).toBe(IMAGE.length);
    unmount();
  });

  it('drags the image to a drop position outside its span', () => {
    const { view, img, container, unmount } = mount(`${IMAGE}\n\ntrailing`);
    vi.spyOn(view, 'posAtCoords').mockReturnValue(view.state.doc.length);

    mouse('mousedown', img, { clientX: 10, clientY: 10 });
    mouse('mousemove', window, { clientX: 40, clientY: 40 });
    // A ghost is mounted while dragging.
    expect(
      document.body.querySelector('img[style*="position: fixed"]')
    ).not.toBeNull();
    mouse('mouseup', window, { clientX: 40, clientY: 40 });

    expect(view.state.doc.toString()).toBe(`\n\ntrailing${IMAGE}`);
    // The moved image is re-rendered at its new position (still one widget).
    expect(container.querySelectorAll('.cm-md-image-wrap')).toHaveLength(1);
    expect(
      document.body.querySelector('img[style*="position: fixed"]')
    ).toBeNull();
    unmount();
  });

  it('dropping the image back onto its own span is a no-op', () => {
    const { view, img, unmount } = mount(IMAGE);
    vi.spyOn(view, 'posAtCoords').mockReturnValue(IMAGE.length - 1);

    mouse('mousedown', img, { clientX: 10, clientY: 10 });
    mouse('mousemove', window, { clientX: 40, clientY: 40 });
    mouse('mouseup', window, { clientX: 40, clientY: 40 });

    expect(view.state.doc.toString()).toBe(IMAGE);
    unmount();
  });

  it('does not move when the drop position cannot be resolved', () => {
    const { view, img, unmount } = mount(IMAGE);
    vi.spyOn(view, 'posAtCoords').mockReturnValue(null);

    mouse('mousedown', img, { clientX: 10, clientY: 10 });
    mouse('mousemove', window, { clientX: 40, clientY: 40 });
    mouse('mouseup', window, { clientX: 40, clientY: 40 });

    expect(view.state.doc.toString()).toBe(IMAGE);
    unmount();
  });

  it('a sub-threshold move behaves like a click', () => {
    const { view, img, unmount } = mount(IMAGE);
    vi.spyOn(view, 'posAtCoords').mockReturnValue(0);

    mouse('mousedown', img, { clientX: 10, clientY: 10 });
    mouse('mousemove', window, { clientX: 12, clientY: 12 });
    mouse('mouseup', window, { clientX: 12, clientY: 12 });

    expect(view.state.doc.toString()).toBe(IMAGE);
    expect(view.state.selection.main.head).toBe(0);
    unmount();
  });

  it('dragging the corner handle persists the width into the markdown', () => {
    const { view, handle, unmount } = mount(IMAGE);
    Object.defineProperty(view.contentDOM, 'clientWidth', {
      configurable: true,
      value: 600,
    });

    mouse('mousedown', handle, { clientX: 100, clientY: 10 });
    mouse('mousemove', window, { clientX: 180, clientY: 10 });
    mouse('mouseup', window, { clientX: 180, clientY: 10 });

    expect(view.state.doc.toString()).toBe(`${IMAGE}{width=80px}`);
    unmount();
  });

  it('clamps the resized width to the minimum', () => {
    const { view, handle, unmount } = mount(IMAGE);
    Object.defineProperty(view.contentDOM, 'clientWidth', {
      configurable: true,
      value: 600,
    });

    mouse('mousedown', handle, { clientX: 100, clientY: 10 });
    mouse('mousemove', window, { clientX: -100, clientY: 10 });
    mouse('mouseup', window, { clientX: -100, clientY: 10 });

    expect(view.state.doc.toString()).toBe(`${IMAGE}{width=64px}`);
    unmount();
  });

  it('Escape cancels a resize without touching the document', () => {
    const { view, handle, unmount } = mount(IMAGE);
    Object.defineProperty(view.contentDOM, 'clientWidth', {
      configurable: true,
      value: 600,
    });

    mouse('mousedown', handle, { clientX: 100, clientY: 10 });
    mouse('mousemove', window, { clientX: 180, clientY: 10 });
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    mouse('mouseup', window, { clientX: 180, clientY: 10 });

    expect(view.state.doc.toString()).toBe(IMAGE);
    unmount();
  });

  it('ignores non-primary buttons', () => {
    const { view, img, unmount } = mount(IMAGE);
    const event = mouse('mousedown', img, { button: 1 });

    expect(event.defaultPrevented).toBe(false);
    expect(view.state.selection.main.head).toBe(0);
    unmount();
  });

  it('ignores gestures that do not start on an image', () => {
    const { view, container, unmount } = mount(IMAGE);
    const content = container.querySelector('.cm-content') as HTMLElement;

    const down = mouse('mousedown', content, { clientX: 10, clientY: 10 });
    const dblclick = mouse('dblclick', content);
    mouse('mouseup', window, { clientX: 10, clientY: 10 });

    // CodeMirror's own handlers may handle the mousedown; ours must not
    // intercept the double-click (no image span is selected as a whole).
    expect(down.type).toBe('mousedown');
    expect(dblclick.defaultPrevented).toBe(false);
    expect(view.state.doc.toString()).toBe(IMAGE);
    unmount();
  });

  it('stops listening after the editor unmounts', () => {
    const { unmount } = mount(IMAGE);
    unmount();

    // No dangling listeners means a late event on the old window is harmless.
    expect(() =>
      mouse('mousemove', window, { clientX: 40, clientY: 40 })
    ).not.toThrow();
  });
});
