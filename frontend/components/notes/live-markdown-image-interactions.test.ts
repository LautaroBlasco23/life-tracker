import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';

/* Pins the change-spec semantics the image drag relies on (see the
 * comment in startImageDrag): every spec in a changes array uses
 * positions in the document BEFORE the transaction — CodeMirror builds
 * the changeset by walking original coordinates (ChangeSet.of tracks
 * progress with a position cursor over the original doc and composes
 * when specs arrive out of order). The old code subtracted the removed
 * length from downward drop positions, which pushed the insertion back
 * into the removal range and made downward moves fail. */
describe('image move transaction semantics', () => {
  const IMG = '![img](http://x/y.png)';

  it('moves the image down using original-document coordinates', () => {
    const doc = `${IMG}\n\nafter line\n`;
    const state = EditorState.create({ doc });
    const from = 0;
    const to = IMG.length;
    // Original-coords drop between "lin" and "e" of "line".
    const hit = doc.lastIndexOf('e');
    const tr = state.update({
      changes: [
        { from, to, insert: '' },
        { from: hit, to: hit, insert: IMG },
      ],
      selection: { anchor: hit },
    });
    const moved = `\n\nafter lin${IMG}e\n`;
    expect(tr.state.doc.toString()).toBe(moved);
    // Selection is auto-mapped: right after the moved image.
    expect(tr.state.selection.main.head).toBe(moved.indexOf(IMG) + IMG.length);
  });

  it('moves the image up with the same spec shape (out-of-order specs compose)', () => {
    const doc = `before line\n\n${IMG}\n`;
    const state = EditorState.create({ doc });
    const from = doc.indexOf(IMG);
    const to = from + IMG.length;
    const hit = 0;
    const tr = state.update({
      changes: [
        { from, to, insert: '' },
        { from: hit, to: hit, insert: IMG },
      ],
      selection: { anchor: hit },
    });
    const moved = `${IMG}before line\n\n\n`;
    expect(tr.state.doc.toString()).toBe(moved);
    // In the out-of-order/compose path the anchor at the insertion
    // boundary maps to just before the inserted image.
    expect(tr.state.selection.main.head).toBe(0);
  });
});
