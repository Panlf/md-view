import { describe, expect, it } from 'vitest';
import { createDocuments, dirty, parentPath } from './documents';
import type { DocumentFile } from '../types';

function file(path = 'D:/project/README.md', content = '# Original'): DocumentFile {
  return {
    id: path.toLowerCase(),
    path,
    content,
    encoding: 'UTF-8',
    bom: false,
    newline: 'lf',
    revision: { modified: '1', size: content.length, hash: content }
  };
}
describe('document sessions', () => {
  it('deduplicates Windows paths and preserves unsaved edits when reopening', () => {
    const docs = createDocuments();
    const id = docs.open(file());
    docs.edit(id, 'Unsaved');
    expect(docs.open(file('d:/PROJECT/readme.md'))).toBe(id);
    expect(docs.snapshot().tabs).toHaveLength(1);
    expect(docs.find(id)?.content).toBe('Unsaved');
  });
  it('keeps each tab mode and reading position independent', () => {
    const docs = createDocuments();
    const a = docs.open(file());
    docs.patch(a, { mode: 'split', previewScroll: 540, editorScroll: 90 });
    const b = docs.open(file('D:/another.md'));
    docs.edit(b, 'Second');
    docs.activate(a);
    expect(docs.find(a)?.previewScroll).toBe(540);
    expect(docs.find(a)?.mode).toBe('split');
    expect(docs.find(b)?.content).toBe('Second');
  });
  it('does not mark newer edits as saved when an earlier save finishes', () => {
    const docs = createDocuments();
    const id = docs.open(file());
    docs.edit(id, 'Snapshot');
    const snapshot = docs.find(id)!;
    docs.edit(id, 'Typed while saving');
    docs.saved(id, file(undefined, 'Snapshot'), snapshot);
    expect(docs.find(id)?.savedContent).toBe('Snapshot');
    expect(docs.find(id)?.content).toBe('Typed while saving');
    expect(dirty(docs.find(id)!)).toBe(true);
  });
  it('preserves stable tab identity and draft content through a folder rename', () => {
    const docs = createDocuments();
    const id = docs.open(file());
    docs.edit(id, 'Draft');
    docs.remap('D:/project', 'D:/renamed');
    expect(docs.find(id)?.path).toBe('D:/renamed/README.md');
    expect(docs.find(id)?.content).toBe('Draft');
    expect(dirty(docs.find(id)!)).toBe(true);
  });
  it('preserves visual undo across tab switches', () => {
    const docs = createDocuments();
    const id = docs.open(file());
    docs.edit(id, 'Visual edit', true);
    const second = docs.create();
    docs.activate(id);
    docs.undoVisual(id);
    expect(docs.find(id)?.content).toBe('# Original');
    docs.undoVisual(id, true);
    expect(docs.find(id)?.content).toBe('Visual edit');
    expect(docs.find(second)).toBeDefined();
  });
  it('retains the slash on Windows drive roots', () => {
    expect(parentPath('D:\\README.md')).toBe('D:/');
  });
});
