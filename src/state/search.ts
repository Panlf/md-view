import { get, writable } from 'svelte/store';
import type { ScanBatch } from '../types';
export type SearchItem = { path: string; label: string; detail: string; line?: number; anchor?: string };
export function filterSearchItems(items: SearchItem[], query: string, limit = 80): SearchItem[] {
  const found: SearchItem[] = [];
  const seen = new Set<string>();
  const needle = query.trim().toLowerCase();
  for (const item of items) {
    const key = `${item.path}:${item.line ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (`${item.label} ${item.detail}`.toLowerCase().includes(needle)) found.push(item);
    if (found.length >= limit) break;
  }
  return found;
}
export function createSearch() {
  const initial = {
    requestId: '',
    root: '',
    kind: 'files' as 'files' | 'headings',
    items: [] as SearchItem[],
    busy: false,
    scanned: 0,
    skipped: 0,
    errors: [] as string[],
    message: '',
    incomplete: false
  };
  const state = writable({ ...initial });
  return {
    subscribe: state.subscribe,
    snapshot: () => get(state),
    begin(root: string, kind: 'files' | 'headings', requestId: string) {
      state.set({ ...initial, root, kind, requestId, busy: true });
    },
    reset() {
      state.set({ ...initial });
    },
    cancel() {
      state.update((s) => ({
        ...s,
        requestId: '',
        busy: false,
        incomplete: true,
        message: '已取消，当前为部分结果'
      }));
    },
    fail(requestId: string, error: string) {
      state.update((s) =>
        s.requestId === requestId ? { ...s, busy: false, incomplete: true, message: error } : s
      );
    },
    batch(batch: ScanBatch) {
      state.update((s) =>
        s.requestId !== batch.request_id
          ? s
          : {
              ...s,
              items: [
                ...s.items,
                ...batch.files.map((file) => ({ path: file.path, label: file.name, detail: file.path })),
                ...batch.headings.map((h) => ({
                  path: h.path,
                  label: h.text,
                  detail: `${h.file_name} · ${h.line}`,
                  line: h.line,
                  anchor: h.anchor
                }))
              ],
              busy: !batch.complete,
              scanned: batch.scanned,
              skipped: batch.skipped,
              incomplete: batch.incomplete || batch.cancelled,
              errors: [...s.errors, ...(batch.errors || [])].slice(0, 50),
              message:
                batch.message ??
                (batch.cancelled ? '已取消，当前为部分结果' : batch.complete ? '搜索完成' : '正在搜索…')
            }
      );
    }
  };
}
