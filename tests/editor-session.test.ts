import { expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { undo } from '@codemirror/commands';
import SessionEditor from './fixtures/SessionEditor.svelte';

it('restores real CodeMirror undo history and selection when a tab remounts', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  let snapshot: EditorState | null = null;
  let app = mount(SessionEditor, {
    target,
    props: { value: 'original', onSnapshot: (state) => (snapshot = state) }
  });
  await tick();
  let view = EditorView.findFromDOM(target.querySelector('.cm-editor')!)!;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: 'first tab edit' },
    selection: { anchor: 4 }
  });
  await tick();
  await unmount(app);
  expect(snapshot).not.toBeNull();
  app = mount(SessionEditor, {
    target,
    props: { value: 'first tab edit', savedState: snapshot, onSnapshot: (state) => (snapshot = state) }
  });
  await tick();
  view = EditorView.findFromDOM(target.querySelector('.cm-editor')!)!;
  expect(view.state.selection.main.anchor).toBe(4);
  expect(undo(view)).toBe(true);
  expect(view.state.doc.toString()).toBe('original');
  await unmount(app);
  target.remove();
});
