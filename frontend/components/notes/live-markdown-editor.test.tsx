import { render, screen, waitFor } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveMarkdownEditor } from './live-markdown-editor';
import { showToast } from '@/lib/toast';

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

function imageView(container: HTMLElement): EditorView {
  const editorDom = container.querySelector('.cm-editor')!;
  const view = EditorView.findFromDOM(editorDom as HTMLElement);
  expect(view).not.toBeNull();
  return view!;
}

function pasteEvent(files: { file: File }[]): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: files.map(({ file }) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
      // CM's own paste fallback reads getData when our handler passes.
      getData: () => '',
    },
  });
  return event;
}

async function pasteImage(
  container: HTMLElement,
  file: File
): Promise<boolean> {
  const content = container.querySelector('.cm-content')!;
  const handled = content.dispatchEvent(pasteEvent([{ file }]));
  return handled;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LiveMarkdownEditor', () => {
  it('mounts a CodeMirror instance with the initial value and aria-label', () => {
    const { container } = render(
      <LiveMarkdownEditor value="# Hello" onChange={vi.fn()} />
    );

    expect(container.querySelector('.cm-content')!.textContent).toBe('# Hello');
    expect(
      container.querySelector('[aria-label="Note content"]')
    ).toBeInTheDocument();
  });

  it('renders the placeholder while the document is empty', () => {
    const { container } = render(
      <LiveMarkdownEditor
        value=""
        onChange={vi.fn()}
        placeholder="Start writing..."
      />
    );

    expect(container.querySelector('.cm-placeholder')!.textContent).toBe(
      'Start writing...'
    );
  });

  it('forwards document changes to onChange', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <LiveMarkdownEditor value="" onChange={onChange} />
    );

    imageView(container).dispatch({
      changes: { from: 0, insert: 'typed text' },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('typed text'));
  });

  it('syncs external value changes into the editor', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <LiveMarkdownEditor value="first" onChange={onChange} />
    );

    rerender(<LiveMarkdownEditor value="second draft" onChange={onChange} />);

    expect(imageView(container).state.doc.toString()).toBe('second draft');
    // The sync dispatch is a document change, so the parent's onChange also
    // sees it (mirrors a real controlled-editor round trip).
    expect(onChange).toHaveBeenCalledWith('second draft');
  });

  it('does not re-dispatch when the external value already matches (echo guard)', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <LiveMarkdownEditor value="same" onChange={onChange} />
    );

    rerender(<LiveMarkdownEditor value="same" onChange={onChange} />);

    // No-op sync would still create an undo entry via a dispatch; assert the
    // document was not touched by waiting a tick and checking the count.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).not.toHaveBeenCalled();
    expect(imageView(container).state.doc.toString()).toBe('same');
  });

  it('destroys the editor view on unmount', () => {
    const { container, unmount } = render(
      <LiveMarkdownEditor value="" onChange={vi.fn()} />
    );

    const view = imageView(container);
    const destroySpy = vi.spyOn(view, 'destroy');
    unmount();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  describe('image paste interception', () => {
    const pngFile = new File([new Uint8Array(8)], 'pic.png', {
      type: 'image/png',
    });

    it('inserts an uploading placeholder, then swaps it for the final markdown', async () => {
      const uploadImage = vi
        .fn()
        .mockResolvedValue('https://cdn.example/p.png');
      const onChange = vi.fn();
      const { container } = render(
        <LiveMarkdownEditor
          value=""
          onChange={onChange}
          uploadImage={uploadImage}
        />
      );

      await pasteImage(container, pngFile);

      // Placeholder goes in immediately, at the caret position.
      expect(onChange).toHaveBeenCalledWith('![Uploading image...]()');
      await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(pngFile));
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          '![Pasted image](https://cdn.example/p.png)'
        )
      );
      expect(showToast).not.toHaveBeenCalled();
    });

    it('uses the custom alt labels when provided', async () => {
      const uploadImage = vi
        .fn()
        .mockResolvedValue('https://cdn.example/p.png');
      const onChange = vi.fn();
      const { container } = render(
        <LiveMarkdownEditor
          value=""
          onChange={onChange}
          uploadImage={uploadImage}
          imageUploadingAlt="Subiendo..."
          imageAlt="Foto pegada"
        />
      );

      await pasteImage(container, pngFile);

      expect(onChange).toHaveBeenCalledWith('![Subiendo...]()');
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          '![Foto pegada](https://cdn.example/p.png)'
        )
      );
    });

    it('removes the placeholder and toasts when the upload fails', async () => {
      const uploadImage = vi.fn().mockRejectedValue(new Error('413'));
      const onChange = vi.fn();
      const { container } = render(
        <LiveMarkdownEditor
          value=""
          onChange={onChange}
          uploadImage={uploadImage}
          imageUploadFailedLabel="Image upload failed"
        />
      );

      await pasteImage(container, pngFile);

      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith({
          title: 'Image upload failed',
          variant: 'destructive',
        })
      );
      // The failed placeholder is cleaned out of the document.
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(''));
      expect(onChange.mock.calls.some(([doc]) => doc === '')).toBe(true);
    });

    it('rejects files above the 10MB cap with a destructive toast', async () => {
      const uploadImage = vi.fn();
      const onChange = vi.fn();
      const { container } = render(
        <LiveMarkdownEditor
          value=""
          onChange={onChange}
          uploadImage={uploadImage}
          imageUploadFailedLabel="Image upload failed"
        />
      );
      const bigFile = new File(
        [new Uint8Array(10 * 1024 * 1024 + 1)],
        'big.png',
        { type: 'image/png' }
      );

      await pasteImage(container, bigFile);

      expect(showToast).toHaveBeenCalledWith({
        title: 'Image upload failed',
        description: 'big.png: > 10MB',
        variant: 'destructive',
      });
      expect(uploadImage).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('intercepts image drops like pastes', async () => {
      const uploadImage = vi
        .fn()
        .mockResolvedValue('https://cdn.example/d.png');
      const onChange = vi.fn();
      const { container } = render(
        <LiveMarkdownEditor
          value=""
          onChange={onChange}
          uploadImage={uploadImage}
        />
      );

      const content = container.querySelector('.cm-content')!;
      const event = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: {
          items: [
            {
              kind: 'file',
              type: 'image/png',
              getAsFile: () => pngFile,
            },
          ],
        },
      });
      content.dispatchEvent(event);

      expect(onChange).toHaveBeenCalledWith('![Uploading image...]()');
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          '![Pasted image](https://cdn.example/d.png)'
        )
      );
    });

    it('lets normal text paste through when no uploader is wired', () => {
      const onChange = vi.fn();
      const { container } = render(
        <LiveMarkdownEditor value="" onChange={onChange} />
      );

      const content = container.querySelector('.cm-content')!;
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: {
          items: [
            {
              kind: 'file',
              type: 'image/png',
              getAsFile: () => pngFile,
            },
          ],
          // CM's own paste fallback reads getData when our handler passes.
          getData: () => '',
        },
      });
      content.dispatchEvent(event);

      expect(onChange).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });

    it('ignores non-file clipboard items', async () => {
      const uploadImage = vi.fn();
      const onChange = vi.fn();
      const { container } = render(
        <LiveMarkdownEditor
          value=""
          onChange={onChange}
          uploadImage={uploadImage}
        />
      );

      const content = container.querySelector('.cm-content')!;
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: {
          items: [
            { kind: 'string', type: 'text/plain', getAsFile: () => null },
          ],
          getData: () => '',
        },
      });
      content.dispatchEvent(event);

      expect(uploadImage).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
