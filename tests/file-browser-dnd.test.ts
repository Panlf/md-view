import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { Component } from 'svelte';
import FileBrowser from '../src/components/FileBrowser.svelte';
import type { DirectoryEntry, FileKind } from '../src/types';
import type { Workspace } from '../src/state/workspace';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

let app: ReturnType<typeof mount> | null = null;

afterEach(async () => {
  if (app) await unmount(app);
  app = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const entry = (path: string, kind: FileKind): DirectoryEntry => ({
  path,
  name: path.split(/[\\/]/).pop() || path,
  kind
});

const directory = (entries: DirectoryEntry[], expanded = true) => ({
  entries,
  expanded,
  loading: false,
  loaded: true,
  errors: [] as string[],
  requestId: '',
  version: ''
});

function buildWorkspace(): Workspace {
  return {
    root: 'C:\\ws',
    directories: {
      'C:\\ws': directory([entry('C:\\ws\\笔记', 'directory'), entry('C:\\ws\\文档.md', 'file')]),
      'C:\\ws\\笔记': directory([], true)
    }
  };
}

function firePointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number
) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    pointerId: number;
    button: number;
    clientX: number;
    clientY: number;
  };
  event.pointerId = 1;
  event.button = 0;
  event.clientX = x;
  event.clientY = y;
  target.dispatchEvent(event);
  return event;
}

function rowButton(name: string): HTMLElement {
  const rows = Array.from(document.querySelectorAll('.file-row > button'));
  const row = rows.find((node) => node.querySelector('span')?.textContent === name);
  if (!row) throw new Error(`row not found: ${name}`);
  return row;
}

function rowContainer(name: string): HTMLElement {
  const container = rowButton(name).closest('.file-row');
  if (!container) throw new Error(`row container not found: ${name}`);
  return container;
}

function mockHitTarget(el: Element | null) {
  (document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }).elementFromPoint =
    vi.fn(() => el);
}

async function setupBrowser() {
  const onMoveEntry = vi.fn();
  const onSelect = vi.fn();
  app = mount(FileBrowser as Component, {
    target: document.body,
    props: {
      workspace: buildWorkspace(),
      selectedPath: '',
      onSelect,
      onRefresh: vi.fn(),
      onMenu: vi.fn(),
      onNewFile: vi.fn(),
      onNewFolder: vi.fn(),
      onChoose: vi.fn(),
      onMoveEntry
    }
  });
  await vi.waitFor(() => {
    if (!document.querySelector('.file-row')) throw new Error('rows not rendered');
  });
  return { onMoveEntry, onSelect };
}

it('dragging a file onto a folder moves it into that folder', async () => {
  const { onMoveEntry } = await setupBrowser();
  mockHitTarget(rowContainer('笔记'));

  firePointer(rowButton('文档.md'), 'pointerdown', 40, 100);
  firePointer(window, 'pointermove', 60, 118);
  await tick();
  expect(document.querySelector('.file-row.drag-over')).not.toBeNull();
  firePointer(window, 'pointerup', 60, 118);

  expect(onMoveEntry).toHaveBeenCalledTimes(1);
  expect(onMoveEntry).toHaveBeenCalledWith(entry('C:\\ws\\文档.md', 'file'), 'C:\\ws\\笔记');
});

it('a click without drag does not move anything', async () => {
  const { onMoveEntry } = await setupBrowser();
  mockHitTarget(rowContainer('笔记'));

  firePointer(rowButton('文档.md'), 'pointerdown', 40, 100);
  firePointer(window, 'pointermove', 42, 101);
  firePointer(window, 'pointerup', 42, 101);

  expect(onMoveEntry).not.toHaveBeenCalled();
});

it('rejects dropping a folder onto itself', async () => {
  const { onMoveEntry } = await setupBrowser();
  mockHitTarget(rowContainer('笔记'));

  firePointer(rowButton('笔记'), 'pointerdown', 40, 60);
  firePointer(window, 'pointermove', 70, 60);
  await tick();
  expect(document.querySelector('.file-row.drag-over')).toBeNull();
  firePointer(window, 'pointerup', 70, 60);

  expect(onMoveEntry).not.toHaveBeenCalled();
});

it('rejects dropping a file onto its own parent workspace header', async () => {
  const { onMoveEntry } = await setupBrowser();
  mockHitTarget(document.querySelector('.browser-heading')!);

  firePointer(rowButton('文档.md'), 'pointerdown', 40, 100);
  firePointer(window, 'pointermove', 60, 10);
  firePointer(window, 'pointerup', 60, 10);

  expect(onMoveEntry).not.toHaveBeenCalled();
});
