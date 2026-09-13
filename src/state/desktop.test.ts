import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentFile } from '../types';
import { dirty } from './documents';
const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
  versions: vi.fn(),
  directory: vi.fn(),
  scan: vi.fn(),
  move: vi.fn(),
  moveDraft: vi.fn(),
  writeDraft: vi.fn(),
  deleteDraft: vi.fn(),
  message: vi.fn(),
  dialogSave: vi.fn(),
  readDraft: vi.fn(),
  trash: vi.fn(),
  cancel: vi.fn()
}));
vi.mock('../api', () => ({
  openDocument: mocks.open,
  saveDocument: mocks.save,
  documentVersions: mocks.versions,
  loadDirectory: mocks.directory,
  scanWorkspace: mocks.scan,
  movePath: mocks.move,
  moveDraft: mocks.moveDraft,
  writeDraft: mocks.writeDraft,
  deleteDraft: mocks.deleteDraft,
  readDraft: mocks.readDraft,
  trashPath: mocks.trash,
  listDrafts: vi.fn(async () => []),
  cancelScan: mocks.cancel,
  watchWorkspace: vi.fn(async () => ({ available: true, failed: [] }))
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(async () => true),
  message: mocks.message,
  open: vi.fn(async () => null),
  save: mocks.dialogSave
}));
import { createDesktop } from './desktop';
function file(path: string, content = 'original'): DocumentFile {
  return {
    id: path,
    path,
    content,
    encoding: 'UTF-8',
    bom: false,
    newline: 'lf',
    revision: { modified: '1', size: content.length, hash: content }
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}
let desktop: ReturnType<typeof createDesktop>;
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.open.mockImplementation(async (path) => file(path));
  mocks.message.mockResolvedValue('保存');
  mocks.writeDraft.mockResolvedValue({});
  mocks.deleteDraft.mockResolvedValue(true);
  mocks.moveDraft.mockResolvedValue(undefined);
  mocks.readDraft.mockResolvedValue(null);
  mocks.versions.mockResolvedValue([]);
  mocks.cancel.mockResolvedValue(undefined);
  desktop = createDesktop();
});
afterEach(() => {
  desktop.dispose();
  vi.useRealTimers();
});
describe('desktop file operations', () => {
  it('opens a document without any folder listing or workspace scan', async () => {
    await desktop.openFile('/huge-project/README.md');
    expect(desktop.workspace.snapshot().root).toBe('');
    expect(mocks.directory).not.toHaveBeenCalled();
    expect(mocks.scan).not.toHaveBeenCalled();
  });
  it('keeps the latest requested document active when reads finish out of order', async () => {
    const slow = deferred<DocumentFile>();
    mocks.open.mockImplementation((path) =>
      path === '/old.md' ? slow.promise : Promise.resolve(file(path))
    );
    const old = desktop.openFile('/old.md');
    await desktop.openFile('/latest.md');
    slow.resolve(file('/old.md'));
    await old;
    const state = desktop.documents.snapshot();
    expect(desktop.documents.find(state.activeId)?.path).toBe('/latest.md');
    expect(state.tabs).toHaveLength(2);
  });
  it('saving does not clear edits typed while disk I/O is pending', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    desktop.edit(id, 'snapshot');
    const pending = deferred<{ file: DocumentFile; code: null; message: null }>();
    mocks.save.mockReturnValue(pending.promise);
    const saving = desktop.saveTab(id);
    desktop.edit(id, 'newer edit');
    pending.resolve({ file: file('/a.md', 'snapshot'), code: null, message: null });
    await saving;
    expect(desktop.documents.find(id)?.content).toBe('newer edit');
    expect(dirty(desktop.documents.find(id)!)).toBe(true);
  });
  it('canceling close preserves the tab and its unsaved content', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    desktop.edit(id, 'keep me');
    mocks.message.mockResolvedValue('取消');
    expect(await desktop.closeTab(id)).toBe(false);
    expect(desktop.documents.find(id)?.content).toBe('keep me');
    expect(mocks.deleteDraft).not.toHaveBeenCalled();
  });
  it('the native custom Save caption saves before closing an edited tab', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    desktop.edit(id, 'save before close');
    mocks.message.mockResolvedValue('保存');
    mocks.save.mockResolvedValue({ file: file('/a.md', 'save before close') });
    expect(await desktop.closeTab(id)).toBe(true);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'save before close' }));
    expect(desktop.documents.find(id)).toBeUndefined();
  });
  it('an unknown close result is treated as cancellation', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    desktop.edit(id, 'keep');
    mocks.message.mockResolvedValue('Unexpected');
    expect(await desktop.closeTab(id)).toBe(false);
    expect(desktop.documents.find(id)?.content).toBe('keep');
  });
  it('external changes cannot overwrite a document edited during reload', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    mocks.versions.mockResolvedValue([['/a.md', { modified: '2', size: 8, hash: 'external' }]]);
    const read = deferred<DocumentFile>();
    mocks.open.mockReturnValue(read.promise);
    const check = desktop.checkExternal();
    await Promise.resolve();
    desktop.edit(id, 'local edit');
    read.resolve(file('/a.md', 'external'));
    await check;
    expect(desktop.documents.find(id)?.content).toBe('local edit');
    expect(desktop.documents.find(id)?.externalChanged).toBe(true);
  });
  it('keeps tabs when a folder is opened and does not automatically start indexing', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    await desktop.openWorkspace('/folder');
    expect(desktop.documents.find(id)).toBeDefined();
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.directory).toHaveBeenCalledTimes(1);
  });
  it('restores compatible drafts without marking disk contents as saved', async () => {
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    vi.mocked(confirm).mockResolvedValue(true);
    mocks.readDraft.mockResolvedValue({ content: 'recovered draft' });
    const id = (await desktop.openFile('/a.md'))!;
    expect(desktop.documents.find(id)?.content).toBe('recovered draft');
    expect(desktop.documents.find(id)?.savedContent).toBe('original');
  });
  it('renaming keeps edits, draft keys and recent paths together', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    desktop.edit(id, 'unsaved');
    mocks.move.mockResolvedValue('/renamed.md');
    const operation = desktop.mutate({ path: '/a.md', name: 'a.md', kind: 'file', size: 8 }, 'rename');
    desktop.resolvePrompt('renamed.md');
    await operation;
    expect(desktop.documents.find(id)?.path).toBe('/renamed.md');
    expect(desktop.documents.find(id)?.content).toBe('unsaved');
    expect(mocks.moveDraft).toHaveBeenCalledWith('/a.md', '/renamed.md');
    const { get } = await import('svelte/store');
    expect(get(desktop.preferences).recent).toEqual(['/renamed.md']);
  });
  it('a failed move leaves tabs and drafts at their original path', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    desktop.edit(id, 'keep');
    mocks.move.mockRejectedValue(new Error('destination exists'));
    const operation = desktop.mutate({ path: '/a.md', name: 'a.md', kind: 'file', size: 8 }, 'rename');
    desktop.resolvePrompt('b.md');
    await operation;
    expect(desktop.documents.find(id)?.path).toBe('/a.md');
    expect(mocks.moveDraft).not.toHaveBeenCalled();
  });
  it('refuses a rename while the same document is saving', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    desktop.edit(id, 'snapshot');
    const disk = deferred<any>();
    mocks.save.mockReturnValue(disk.promise);
    const saving = desktop.saveTab(id);
    const operation = desktop.mutate({ path: '/a.md', name: 'a.md', kind: 'file', size: 8 }, 'rename');
    desktop.resolvePrompt('b.md');
    await operation;
    expect(mocks.move).not.toHaveBeenCalled();
    disk.resolve({ file: file('/a.md', 'snapshot') });
    await saving;
  });
  it('keeps edits typed while a close is deleting an older draft', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    const deleting = deferred<boolean>();
    mocks.deleteDraft.mockReturnValue(deleting.promise);
    const closing = desktop.closeTab(id);
    await Promise.resolve();
    desktop.edit(id, 'new edit');
    deleting.resolve(true);
    expect(await closing).toBe(false);
    expect(desktop.documents.find(id)?.content).toBe('new edit');
  });
  it('refreshes a Windows root through its existing cache key', async () => {
    await desktop.openWorkspace('D:\\project');
    await desktop.refreshDirectory('D:/project');
    expect(Object.keys(desktop.workspace.snapshot().directories)).toEqual(['D:\\project']);
  });
  it('a delayed cancellation cannot restore directories from the previous workspace', async () => {
    await desktop.openWorkspace('/old');
    const cancellation = deferred<void>();
    mocks.cancel.mockReturnValue(cancellation.promise);
    const refresh = desktop.refreshDirectory('/old');
    await desktop.openWorkspace('/new');
    cancellation.resolve();
    await refresh;
    expect(Object.keys(desktop.workspace.snapshot().directories)).toEqual(['/new']);
  });
  it('does not apply a stale external read after a newer version was saved', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    mocks.versions.mockResolvedValue([['/a.md', file('/a.md', 'external').revision]]);
    const read = deferred<DocumentFile>();
    mocks.open.mockReturnValue(read.promise);
    const check = desktop.checkExternal();
    await Promise.resolve();
    desktop.edit(id, 'my saved edit');
    mocks.save.mockResolvedValue({ file: file('/a.md', 'my saved edit') });
    await desktop.saveTab(id);
    read.resolve(file('/a.md', 'external'));
    await check;
    expect(desktop.documents.find(id)?.content).toBe('my saved edit');
    expect(desktop.documents.find(id)?.externalChanged).toBe(false);
  });
  it('ignores a disk-version response captured before a successful save', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    const versions = deferred<any>();
    mocks.versions.mockReturnValue(versions.promise);
    const check = desktop.checkExternal();
    desktop.edit(id, 'saved');
    mocks.save.mockResolvedValue({ file: file('/a.md', 'saved') });
    await desktop.saveTab(id);
    versions.resolve([['/a.md', file('/a.md').revision]]);
    await check;
    expect(desktop.documents.find(id)?.content).toBe('saved');
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });
  it('a pending manual reload cannot replace a document after Save As', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    const read = deferred<DocumentFile>();
    mocks.open.mockReturnValue(read.promise);
    const reload = desktop.reload(id);
    mocks.dialogSave.mockResolvedValue('/copy.md');
    mocks.save.mockResolvedValue({ file: file('/copy.md', 'original') });
    await desktop.saveTab(id, true);
    read.resolve(file('/a.md', 'stale original'));
    await reload;
    expect(desktop.documents.find(id)?.path).toBe('/copy.md');
    expect(desktop.documents.find(id)?.content).toBe('original');
  });
  it('allows saving a clean document whose original file disappeared', async () => {
    const id = (await desktop.openFile('/a.md'))!;
    desktop.documents.patch(id, { missing: true, externalChanged: true });
    mocks.save.mockResolvedValue({ file: file('/a.md') });
    expect(await desktop.saveTab(id)).toBe(true);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it('a read started before a folder rename cannot reopen its old path', async () => {
    const read = deferred<DocumentFile>();
    mocks.open.mockReturnValue(read.promise);
    const opening = desktop.openFile('/folder/a.md');
    mocks.move.mockResolvedValue('/renamed');
    const operation = desktop.mutate(
      { path: '/folder', name: 'folder', kind: 'directory', size: 0 },
      'rename'
    );
    desktop.resolvePrompt('renamed');
    await operation;
    read.resolve(file('/folder/a.md'));
    await opening;
    expect(desktop.documents.snapshot().tabs).toHaveLength(0);
  });
  it('does not restore an old-path draft after the document was saved elsewhere', async () => {
    const draft = deferred<any>();
    mocks.readDraft.mockReturnValue(draft.promise);
    const opening = desktop.openFile('/a.md');
    await Promise.resolve();
    const id = desktop.documents.snapshot().activeId;
    expect(id).not.toBe('');
    mocks.dialogSave.mockResolvedValue('/copy.md');
    mocks.save.mockResolvedValue({ file: file('/copy.md') });
    await desktop.saveTab(id, true);
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    vi.mocked(confirm).mockResolvedValue(true);
    draft.resolve({ content: 'stale draft' });
    await opening;
    expect(desktop.documents.find(id)?.content).toBe('original');
    expect(confirm).not.toHaveBeenCalled();
  });
  it('refuses a folder move while Save As is writing a new file inside it', async () => {
    const id = desktop.createDocument();
    desktop.edit(id, 'new document');
    mocks.dialogSave.mockResolvedValue('/folder/new.md');
    const disk = deferred<any>();
    mocks.save.mockReturnValue(disk.promise);
    const saving = desktop.saveTab(id);
    await Promise.resolve();
    mocks.move.mockResolvedValue('/renamed');
    const operation = desktop.mutate(
      { path: '/folder', name: 'folder', kind: 'directory', size: 0 },
      'rename'
    );
    desktop.resolvePrompt('renamed');
    await operation;
    expect(mocks.move).not.toHaveBeenCalled();
    disk.resolve({ file: file('/folder/new.md', 'new document') });
    await saving;
  });
  it('refuses Save As into a folder while it is being moved', async () => {
    const id = desktop.createDocument();
    const moving = deferred<string>();
    mocks.move.mockReturnValue(moving.promise);
    const operation = desktop.mutate(
      { path: '/folder', name: 'folder', kind: 'directory', size: 0 },
      'rename'
    );
    desktop.resolvePrompt('renamed');
    // Flush the draft queue before the filesystem operation starts.
    for (let step = 0; step < 12; step++) await Promise.resolve();
    expect(mocks.move).toHaveBeenCalled();
    mocks.dialogSave.mockResolvedValue('/folder/new.md');
    mocks.save.mockResolvedValue({ file: file('/folder/new.md') });
    expect(await desktop.saveTab(id)).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    moving.resolve('/renamed');
    await operation;
  });
});
