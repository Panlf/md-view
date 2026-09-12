import { expect, it } from 'vitest';
import { createWorkspace, flattenTree } from './workspace';
import { createSearch, filterSearchItems } from './search';
import { createDraftQueue } from './drafts';
import type { DirectoryBatch, ScanBatch } from '../types';

it('ignores directory batches belonging to a replaced workspace request', () => {
  const workspace = createWorkspace();
  workspace.setRoot('/new');
  workspace.begin('/new', 'current');
  const batch: DirectoryBatch = {
    request_id: 'old',
    path: '/new',
    entries: [{ path: '/new/stale.md', name: 'stale', kind: 'file', size: 1 }],
    errors: [],
    complete: true,
    version: '1'
  };
  workspace.batch(batch);
  expect(flattenTree(workspace.snapshot())).toHaveLength(0);
  workspace.batch({ ...batch, request_id: 'current' });
  expect(flattenTree(workspace.snapshot())).toHaveLength(1);
});
it('does not expose cached descendants of a collapsed directory', () => {
  const workspace = createWorkspace();
  workspace.setRoot('/root');
  workspace.begin('/root', 'r');
  workspace.batch({
    request_id: 'r',
    path: '/root',
    entries: [{ path: '/root/docs', name: 'docs', kind: 'directory', size: 0 }],
    errors: [],
    complete: true,
    version: '1'
  });
  workspace.begin('/root/docs', 'd');
  workspace.batch({
    request_id: 'd',
    path: '/root/docs',
    entries: [{ path: '/root/docs/a.md', name: 'a.md', kind: 'file', size: 1 }],
    errors: [],
    complete: true,
    version: '1'
  });
  expect(flattenTree(workspace.snapshot())).toHaveLength(2);
  workspace.collapse('/root/docs');
  expect(flattenTree(workspace.snapshot())).toHaveLength(1);
});
it('discarding a search generation also discards its late results', () => {
  const search = createSearch();
  search.begin('/a', 'files', 'old');
  search.cancel();
  search.begin('/b', 'files', 'new');
  const batch: ScanBatch = {
    request_id: 'old',
    files: [{ name: 'stale', path: '/a.md', kind: 'file', size: 0 }],
    headings: [],
    scanned: 10,
    skipped: 0,
    elapsed_ms: 10,
    complete: true,
    incomplete: false,
    cancelled: false,
    message: null
  };
  search.batch(batch);
  expect(search.snapshot().items).toHaveLength(0);
  expect(search.snapshot().busy).toBe(true);
});
it('searches a large snapshot without duplicate results or a quadratic duplicate check', () => {
  const items = Array.from({ length: 100_000 }, (_, i) => ({
    path: `/project/${i}.md`,
    label: `${i}.md`,
    detail: 'project'
  }));
  const results = filterSearchItems([...items, ...items.slice(0, 5)], '99999');
  expect(results.map((item) => item.path)).toEqual(['/project/99999.md']);
});
it('a late draft write cannot run after a queued delete', async () => {
  const queue = createDraftQueue();
  const actions: string[] = [];
  let finish!: () => void;
  const write = queue.run('file', async () => {
    await new Promise<void>((resolve) => (finish = resolve));
    actions.push('write');
  });
  const remove = queue.run('file', async () => {
    actions.push('delete');
  });
  await Promise.resolve();
  await Promise.resolve();
  finish();
  await Promise.all([write, remove]);
  expect(actions).toEqual(['write', 'delete']);
});
