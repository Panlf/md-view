import { get, writable } from 'svelte/store';
import type { DirectoryBatch, DirectoryEntry } from '../types';
import { isWithin } from './documents';
export type DirectoryState = {
  entries: DirectoryEntry[];
  expanded: boolean;
  loading: boolean;
  loaded: boolean;
  errors: string[];
  requestId: string;
  version: string;
};
export type Workspace = { root: string; directories: Record<string, DirectoryState> };
export type TreeRow = {
  entry: DirectoryEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
  error: string;
};
export function flattenTree(workspace: Workspace): TreeRow[] {
  const rows: TreeRow[] = [];
  const visit = (path: string, depth: number) => {
    for (const entry of workspace.directories[path]?.entries ?? []) {
      const dir = workspace.directories[entry.path];
      rows.push({
        entry,
        depth,
        expanded: dir?.expanded ?? false,
        loading: dir?.loading ?? false,
        error: dir?.errors.join('\n') ?? ''
      });
      if (entry.kind === 'directory' && dir?.expanded) visit(entry.path, depth + 1);
    }
  };
  if (workspace.root) visit(workspace.root, 0);
  return rows;
}
export function createWorkspace() {
  const state = writable<Workspace>({ root: '', directories: {} });
  return {
    subscribe: state.subscribe,
    snapshot: () => get(state),
    setRoot(root: string) {
      state.set({ root, directories: {} });
    },
    invalidate(path: string) {
      state.update((s) => ({
        ...s,
        directories: Object.fromEntries(Object.entries(s.directories).filter(([key]) => !isWithin(key, path)))
      }));
    },
    collapse(path: string) {
      state.update((s) => ({
        ...s,
        directories: { ...s.directories, [path]: { ...s.directories[path], expanded: false } }
      }));
    },
    expand(path: string) {
      state.update((s) => ({
        ...s,
        directories: { ...s.directories, [path]: { ...s.directories[path], expanded: true } }
      }));
    },
    begin(path: string, requestId: string) {
      state.update((s) => ({
        ...s,
        directories: {
          ...s.directories,
          [path]: {
            entries: [],
            expanded: true,
            loading: true,
            loaded: false,
            errors: [],
            requestId,
            version: ''
          }
        }
      }));
    },
    batch(batch: DirectoryBatch) {
      state.update((s) => {
        const current = s.directories[batch.path];
        if (!current || current.requestId !== batch.request_id) return s;
        const entries = [...current.entries, ...batch.entries];
        if (batch.complete)
          entries.sort(
            (a, b) =>
              Number(b.kind === 'directory') - Number(a.kind === 'directory') ||
              a.name.localeCompare(b.name, undefined, { numeric: true })
          );
        return {
          ...s,
          directories: {
            ...s.directories,
            [batch.path]: {
              ...current,
              entries,
              errors: [...current.errors, ...batch.errors],
              loading: !batch.complete,
              loaded: batch.complete,
              version: batch.version
            }
          }
        };
      });
    },
    fail(path: string, requestId: string, error: string) {
      state.update((s) => {
        const dir = s.directories[path];
        if (!dir || dir.requestId !== requestId) return s;
        return {
          ...s,
          directories: {
            ...s.directories,
            [path]: { ...dir, loading: false, errors: [...dir.errors, error] }
          }
        };
      });
    }
  };
}
