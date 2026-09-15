import { get, writable } from 'svelte/store';
import type { EditorState } from '@codemirror/state';
import type { DiskRevision, DocumentFile, ViewMode } from '../types';
import { childPath, filename, isWithin, parentPath, pathKey } from './paths';

export { childPath, filename, isWithin, parentPath, pathKey };

export type DocumentSession = {
  id: string;
  path: string;
  key: string;
  content: string;
  savedContent: string;
  version: number;
  savedVersion: number;
  encoding: string;
  bom: boolean;
  newline: string;
  revision: DiskRevision | null;
  mode: ViewMode;
  editorState: EditorState | null;
  editorScroll: number;
  previewScroll: number;
  visualScroll: number;
  externalChanged: boolean;
  missing: boolean;
  past: string[];
  future: string[];
};
export type SessionState = { tabs: DocumentSession[]; activeId: string };
export const LARGE_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const dirty = (doc: DocumentSession) => doc.content !== doc.savedContent || !doc.path;
export const draftKey = (doc: DocumentSession) => doc.path || `untitled:${doc.id}`;

function session(file?: DocumentFile, id: string = crypto.randomUUID()): DocumentSession {
  return {
    id,
    path: file?.path ?? '',
    key: file?.id ?? id,
    content: file?.content ?? '',
    savedContent: file?.content ?? '',
    version: 0,
    savedVersion: 0,
    encoding: file?.encoding ?? 'UTF-8',
    bom: file?.bom ?? false,
    newline: file?.newline ?? 'lf',
    revision: file?.revision ?? null,
    mode: !file || file.revision.size > LARGE_DOCUMENT_BYTES ? 'edit' : 'read',
    editorState: null,
    editorScroll: 0,
    previewScroll: 0,
    visualScroll: 0,
    externalChanged: false,
    missing: false,
    past: [],
    future: []
  };
}

export function createDocuments() {
  const state = writable<SessionState>({ tabs: [], activeId: '' });
  // 空更新直接返回原状态，避免无意义的对象克隆与订阅通知。
  const patch = (
    id: string,
    update: Partial<DocumentSession> | ((doc: DocumentSession) => Partial<DocumentSession>)
  ) =>
    state.update((s) => {
      let changed = false;
      const tabs = s.tabs.map((doc) => {
        if (doc.id !== id) return doc;
        const partial = typeof update === 'function' ? update(doc) : update;
        if (!partial || Object.keys(partial).length === 0) return doc;
        changed = true;
        return { ...doc, ...partial };
      });
      return changed ? { ...s, tabs } : s;
    });
  return {
    subscribe: state.subscribe,
    snapshot: () => get(state),
    find: (id: string) => get(state).tabs.find((doc) => doc.id === id),
    patch,
    activate(id: string) {
      state.update((s) => (s.tabs.some((doc) => doc.id === id) ? { ...s, activeId: id } : s));
    },
    open(file: DocumentFile, activate = true) {
      let selected = '';
      state.update((s) => {
        const existing = s.tabs.find(
          (doc) => doc.key === file.id || pathKey(doc.path) === pathKey(file.path)
        );
        const doc = existing ?? session(file);
        selected = doc.id;
        return { tabs: existing ? s.tabs : [...s.tabs, doc], activeId: activate ? doc.id : s.activeId };
      });
      return selected;
    },
    create(id?: string, content = '') {
      const doc = session(undefined, id);
      doc.content = content;
      state.update((s) => ({ tabs: [...s.tabs, doc], activeId: doc.id }));
      return doc.id;
    },
    edit(id: string, content: string, visual = false) {
      patch(id, (doc) =>
        content === doc.content
          ? {}
          : {
              content,
              version: doc.version + 1,
              ...(visual ? { past: [...doc.past.slice(-99), doc.content], future: [] } : {})
            }
      );
    },
    undoVisual(id: string, redo = false) {
      patch(id, (doc) => {
        const source = redo ? doc.future : doc.past;
        if (!source.length) return {};
        return {
          content: source[source.length - 1],
          version: doc.version + 1,
          past: redo ? [...doc.past, doc.content] : doc.past.slice(0, -1),
          future: redo ? doc.future.slice(0, -1) : [...doc.future, doc.content]
        };
      });
    },
    saved(id: string, file: DocumentFile, snapshot: { content: string; version: number }) {
      patch(id, {
        path: file.path,
        key: file.id,
        savedContent: snapshot.content,
        savedVersion: snapshot.version,
        revision: file.revision,
        encoding: file.encoding,
        bom: file.bom,
        newline: file.newline,
        externalChanged: false,
        missing: false
      });
    },
    reload(id: string, file: DocumentFile) {
      patch(id, (doc) => ({
        content: file.content,
        savedContent: file.content,
        revision: file.revision,
        encoding: file.encoding,
        bom: file.bom,
        newline: file.newline,
        version: doc.version + 1,
        savedVersion: doc.version + 1,
        editorState: null,
        past: [],
        future: [],
        externalChanged: false,
        missing: false
      }));
    },
    close(id: string) {
      state.update((s) => {
        const index = s.tabs.findIndex((doc) => doc.id === id);
        const tabs = s.tabs.filter((doc) => doc.id !== id);
        return {
          tabs,
          activeId: s.activeId === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? '') : s.activeId
        };
      });
    },
    remap(from: string, to: string) {
      state.update((s) => ({
        ...s,
        tabs: s.tabs.map((doc) => {
          if (!doc.path || !isWithin(doc.path, from)) return doc;
          const path = to + doc.path.slice(from.length);
          return { ...doc, path, key: pathKey(path) };
        })
      }));
    }
  };
}
