import { get, writable } from 'svelte/store';
import { confirm, message, open, save } from '@tauri-apps/plugin-dialog';
import * as api from '../api';
import {
  createDocuments,
  dirty,
  draftKey,
  filename,
  isWithin,
  parentPath,
  childPath,
  pathKey,
  type DocumentSession
} from './documents';
import { createWorkspace, flattenTree } from './workspace';
import { createSearch, type SearchItem } from './search';
import { createDraftQueue } from './drafts';
import {
  loadShellPreferences,
  rememberFile,
  saveShellPreferences,
  type ShellPreferences
} from './preferences';
import type { DirectoryEntry, DocumentFile, SaveRequest } from '../types';

const LAST_WORKSPACE_KEY = 'md-view-last-workspace-path';

export function createDesktop() {
  const documents = createDocuments();
  const workspace = createWorkspace();
  const search = createSearch();
  const preferences = writable<ShellPreferences>(loadShellPreferences());
  const status = writable('准备就绪');
  const saving = writable(new Set<string>());
  const prompt = writable<{ title: string; value: string; resolve: (value: string | null) => void } | null>(
    null
  );
  const draftQueue = createDraftQueue();
  const draftTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const pendingOpen = new Map<string, { promise: Promise<DocumentFile>; invalidated: boolean }>();
  const saveTargets = new Map<string, string>();
  let openGeneration = 0;
  let disposed = false;
  let watchQueue = Promise.resolve();
  let checking = false;
  let checkAgain = false;
  let operationPending = false;
  const changingPaths = new Set<string>();
  const pathBusy = (path: string) => Boolean(path) && [...changingPaths].some((root) => isWithin(path, root));
  function invalidatePendingOpens(root: string) {
    for (const [key, pending] of pendingOpen) {
      if (isWithin(key, root)) pending.invalidated = true;
    }
  }

  function setPreferences(next: ShellPreferences) {
    preferences.set(next);
    saveShellPreferences(next);
  }
  function remember(path: string) {
    if (path) setPreferences(rememberFile(get(preferences), path));
  }
  function activate(id: string) {
    openGeneration += 1;
    documents.activate(id);
  }
  function askName(title: string, value: string) {
    get(prompt)?.resolve(null);
    return new Promise<string | null>((resolve) => prompt.set({ title, value, resolve }));
  }
  function resolvePrompt(value: string | null) {
    get(prompt)?.resolve(value);
    prompt.set(null);
  }
  async function error(cause: unknown) {
    const text = String(cause);
    status.set(text);
    await message(text, { title: '操作未完成', kind: 'error' });
  }
  function expandedPaths() {
    const value = workspace.snapshot();
    return value.root
      ? [
          value.root,
          ...flattenTree(value)
            .filter((row) => row.entry.kind === 'directory' && row.expanded)
            .map((row) => row.entry.path)
        ]
      : [];
  }
  function updateWatches() {
    watchQueue = watchQueue
      .catch(() => {})
      .then(async () => {
        if (disposed) return;
        const paths = new Set([
          ...expandedPaths(),
          ...documents
            .snapshot()
            .tabs.filter((doc) => doc.path)
            .map((doc) => parentPath(doc.path))
        ]);
        try {
          const reply = await api.watchWorkspace([...paths]);
          if (!reply.available) status.set('部分目录无法实时监听，将在切回窗口或刷新时检查');
        } catch {
          status.set('实时监听不可用，可手动刷新');
        }
      });
  }
  async function refreshDirectory(path: string) {
    const value = workspace.snapshot();
    if (!value.root || !isWithin(path, value.root)) return;
    path =
      Object.keys(value.directories).find((key) => pathKey(key) === pathKey(path)) ||
      (pathKey(path) === pathKey(value.root) ? value.root : path);
    const previous = value.directories[path];
    // Replace the request synchronously: an IPC cancellation may finish after the workspace changes.
    if (previous?.loading) void api.cancelScan(previous.requestId).catch(() => {});
    const requestId = crypto.randomUUID();
    workspace.begin(path, requestId);
    try {
      await api.loadDirectory(value.root, path, get(preferences).excludes, requestId, workspace.batch);
    } catch (cause) {
      workspace.fail(path, requestId, String(cause));
    }
  }
  async function refreshVisible() {
    await Promise.all(expandedPaths().map(refreshDirectory));
    await checkExternal();
  }
  async function openWorkspace(path: string) {
    cancelSearch();
    for (const dir of Object.values(workspace.snapshot().directories))
      if (dir.loading) void api.cancelScan(dir.requestId);
    workspace.setRoot(path);
    localStorage.setItem(LAST_WORKSPACE_KEY, path);
    search.reset();
    setPreferences({ ...get(preferences), leftClosed: false });
    await refreshDirectory(path);
    updateWatches();
    status.set('文件夹已打开');
  }

  // 启动时无命令行参数时恢复上次打开的工作区；文件夹已失效则清掉记录，不打断启动。
  async function restoreLastWorkspace() {
    const saved = localStorage.getItem(LAST_WORKSPACE_KEY);
    if (!saved) return;
    try {
      if ((await api.pathKind(saved)) !== 'directory') throw new Error('not a directory');
      await openWorkspace(saved);
    } catch {
      localStorage.removeItem(LAST_WORKSPACE_KEY);
    }
  }
  async function toggleDirectory(entry: DirectoryEntry) {
    const current = workspace.snapshot().directories[entry.path];
    if (current?.expanded) workspace.collapse(entry.path);
    else if (current?.loaded) workspace.expand(entry.path);
    else await refreshDirectory(entry.path);
    updateWatches();
  }
  async function openFile(path: string) {
    if (pathBusy(path)) {
      status.set('文件正在移动或删除，请稍后打开');
      return;
    }
    const generation = ++openGeneration;
    const existing = documents.snapshot().tabs.find((doc) => doc.path && pathKey(doc.path) === pathKey(path));
    if (existing) {
      documents.activate(existing.id);
      return existing.id;
    }
    if ([...saveTargets.values()].some((target) => pathKey(target) === pathKey(path))) {
      status.set('目标文件正在保存，请稍后打开');
      return;
    }
    status.set(`正在打开 ${filename(path)}…`);
    try {
      const key = pathKey(path);
      let pending = pendingOpen.get(key);
      if (!pending) {
        pending = { promise: api.openDocument(path), invalidated: false };
        pendingOpen.set(key, pending);
      }
      let file: DocumentFile;
      try {
        file = await pending.promise;
      } finally {
        if (pendingOpen.get(key) === pending) pendingOpen.delete(key);
      }
      if (disposed || pending.invalidated || pathBusy(file.path)) return;
      const id = documents.open(file, generation === openGeneration);
      const opened = documents.find(id)!;
      remember(file.path);
      updateWatches();
      const draft = await api.readDraft(file.path).catch((cause) => {
        status.set(`文件已打开，但草稿无法读取：${String(cause)}`);
        return null;
      });
      if (
        draft &&
        draft.content !== file.content &&
        sameDiskState(documents.find(id), opened) &&
        documents.find(id)?.version === 0 &&
        (await confirm(`恢复 ${filename(file.path)} 的未保存草稿？`, { title: '发现草稿', kind: 'info' }))
      ) {
        if (sameDiskState(documents.find(id), opened) && documents.find(id)?.version === 0) {
          documents.edit(id, draft.content);
          scheduleDraft(id);
        }
      }
      if (generation === openGeneration) status.set('文件已打开');
      return id;
    } catch (cause) {
      await error(cause);
    }
  }
  async function openPath(path: string) {
    try {
      if ((await api.pathKind(path)) === 'directory') await openWorkspace(path);
      else await openFile(path);
    } catch (cause) {
      await error(cause);
    }
  }
  async function chooseFiles() {
    const paths = await open({ multiple: true, title: '打开文本文件' });
    if (Array.isArray(paths)) {
      for (const path of paths) await openFile(path);
    } else if (typeof paths === 'string') await openFile(paths);
  }
  async function chooseWorkspace() {
    const path = await open({ directory: true, multiple: false, title: '打开文件夹' });
    if (typeof path === 'string') await openWorkspace(path);
  }
  function createDocument() {
    openGeneration += 1;
    return documents.create();
  }

  function scheduleDraft(id: string) {
    clearTimeout(draftTimers.get(id));
    draftTimers.set(
      id,
      setTimeout(async () => {
        draftTimers.delete(id);
        const doc = documents.find(id);
        if (!doc) return;
        if (pathBusy(doc.path)) {
          scheduleDraft(id);
          return;
        }
        try {
          const key = draftKey(doc);
          if (dirty(doc)) await draftQueue.run(key, () => api.writeDraft(key, doc.content));
          else await draftQueue.run(key, () => api.deleteDraft(key));
          if (get(preferences).autoWrite && doc.path && !doc.externalChanged && dirty(doc))
            await saveTab(id, false, true);
        } catch (cause) {
          status.set(`草稿未保存：${String(cause)}`);
        }
      }, 900)
    );
  }
  function edit(id: string, content: string, visual = false) {
    documents.edit(id, content, visual);
    scheduleDraft(id);
  }

  async function saveTab(id: string, saveAs = false, automatic = false): Promise<boolean> {
    const doc = documents.find(id);
    if (!doc) return false;
    if (pathBusy(doc.path)) {
      status.set('文件操作进行中，请稍后保存');
      return false;
    }
    if (get(saving).has(id)) return false;
    if (!saveAs && doc.path && !dirty(doc) && !doc.externalChanged && !doc.missing) return true;
    saving.update((value) => new Set([...value, id]));
    const snapshot = { content: doc.content, version: doc.version };
    const oldDraftKey = draftKey(doc);
    try {
      let path = doc.path;
      if (saveAs || !path) {
        const selected = await save({
          title: '保存 Markdown',
          defaultPath: path || childPath(workspace.snapshot().root || '.', '未命名.md'),
          filters: [
            { name: 'Markdown', extensions: ['md', 'markdown'] },
            { name: '文本', extensions: ['txt'] }
          ]
        });
        if (!selected) return false;
        path = selected;
        if (
          documents.snapshot().tabs.some((other) => other.id !== id && pathKey(other.path) === pathKey(path))
        ) {
          throw new Error('目标文件已在另一个标签中打开，请先处理该标签');
        }
      }
      if (pathBusy(path)) throw new Error('目标目录正在移动或删除，请稍后保存');
      if ([...saveTargets].some(([otherId, target]) => otherId !== id && pathKey(target) === pathKey(path)))
        throw new Error('目标文件正在由另一个标签保存，请稍后重试');
      saveTargets.set(id, path);
      invalidatePendingOpens(path);
      const request: SaveRequest = {
        path,
        content: snapshot.content,
        encoding: doc.encoding,
        bom: doc.bom,
        newline: doc.newline,
        expected: pathKey(path) === pathKey(doc.path) ? doc.revision : null
      };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const reply = await api.saveDocument(request);
        if (reply.file) {
          if (!documents.find(id)) return true;
          documents.saved(id, reply.file, snapshot);
          remember(reply.file.path);
          clearTimeout(draftTimers.get(id));
          draftTimers.delete(id);
          await draftQueue.run(oldDraftKey, () => api.deleteDraft(oldDraftKey));
          const current = documents.find(id);
          if (current && dirty(current)) scheduleDraft(id);
          status.set(current && dirty(current) ? '已保存；仍有新的编辑待保存' : '文件已保存');
          void refreshDirectory(parentPath(reply.file.path));
          updateWatches();
          return true;
        }
        if (automatic) {
          documents.patch(id, { externalChanged: reply.code === 'conflict' });
          status.set(reply.message || '自动写回暂停，请手动保存');
          return false;
        }
        if (reply.code === 'encoding') {
          if (
            !(await confirm(`${reply.message}\n转换为 UTF-8 后保存？`, {
              title: '保存编码',
              kind: 'warning'
            }))
          )
            return false;
          request.encoding = 'UTF-8';
          request.bom = false;
        } else {
          const latest = (await api.documentVersions([path]))[0]?.[1] ?? null;
          if (
            !(await confirm(`${reply.message}\n用当前编辑内容覆盖此目标？`, {
              title: '保存冲突',
              kind: 'warning'
            }))
          )
            return false;
          request.expected = latest;
        }
      }
      status.set('目标持续变化，请稍后重试或另存为');
      return false;
    } catch (cause) {
      if (automatic) status.set(`自动写回暂停：${String(cause)}`);
      else await error(cause);
      return false;
    } finally {
      saveTargets.delete(id);
      saving.update((value) => {
        const next = new Set(value);
        next.delete(id);
        return next;
      });
    }
  }

  async function prepareClose(id: string) {
    const doc = documents.find(id);
    if (!doc) return true;
    if (pathBusy(doc.path)) {
      status.set('文件操作进行中，请稍后关闭');
      return false;
    }
    if (get(saving).has(id)) {
      status.set('此文档正在保存，请稍后关闭');
      return false;
    }
    if (!dirty(doc)) return true;
    const choice = await message(`保存对“${filename(doc.path)}”的更改？`, {
      title: '未保存的文档',
      kind: 'warning',
      buttons: { yes: '保存', no: '放弃', cancel: '取消' }
    });
    // Tauri returns the custom button caption; default buttons return Yes/No/Cancel.
    const saveChosen = choice === '保存' || choice === 'Yes';
    const discardChosen = choice === '放弃' || choice === 'No';
    if (!saveChosen && !discardChosen) return false;
    if (discardChosen && documents.find(id)?.version !== doc.version) {
      status.set('文档又有新的编辑，请重新处理关闭操作');
      return false;
    }
    if (saveChosen) {
      if (!(await saveTab(id)) || (documents.find(id) && dirty(documents.find(id)!))) return false;
    }
    return true;
  }
  async function closeTab(id: string) {
    if (!(await prepareClose(id))) return false;
    const doc = documents.find(id);
    if (!doc) return true;
    clearTimeout(draftTimers.get(id));
    draftTimers.delete(id);
    try {
      await draftQueue.run(draftKey(doc), () => api.deleteDraft(draftKey(doc)));
    } catch (cause) {
      scheduleDraft(id);
      await error(cause);
      return false;
    }
    if (documents.find(id)?.version !== doc.version) {
      scheduleDraft(id);
      status.set('文档又有新的编辑，已保留标签');
      return false;
    }
    documents.close(id);
    updateWatches();
    return true;
  }
  async function closeAll() {
    // Complete all decisions before deleting any unsaved drafts or closing tabs.
    const tabs = documents.snapshot().tabs;
    const versions = new Map<string, number>();
    for (const doc of tabs) {
      if (!(await prepareClose(doc.id))) return false;
      versions.set(doc.id, documents.find(doc.id)?.version ?? -1);
    }
    if (documents.snapshot().tabs.some((doc) => versions.get(doc.id) !== doc.version)) {
      status.set('关闭期间有新的文档或编辑，已保留当前会话');
      return false;
    }
    for (const doc of tabs) {
      clearTimeout(draftTimers.get(doc.id));
      await draftQueue.run(draftKey(doc), () => api.deleteDraft(draftKey(doc)));
    }
    await draftQueue.flush();
    if (documents.snapshot().tabs.some((doc) => versions.get(doc.id) !== doc.version)) {
      await flushDrafts();
      status.set('关闭期间有新的编辑，已保留会话和草稿');
      return false;
    }
    return true;
  }
  async function flushDrafts() {
    for (const doc of documents.snapshot().tabs) {
      clearTimeout(draftTimers.get(doc.id));
      if (dirty(doc)) await draftQueue.run(draftKey(doc), () => api.writeDraft(draftKey(doc), doc.content));
    }
    await draftQueue.flush();
  }
  async function restoreUntitled() {
    try {
      for (const draft of await api.listDrafts()) {
        if (!draft.path.startsWith('untitled:')) continue;
        const content = await api.readDraft(draft.path);
        if (content && (await confirm('恢复上次未命名文档的草稿？', { title: '恢复草稿', kind: 'info' })))
          documents.create(draft.path.slice(9), content.content);
      }
    } catch (cause) {
      status.set(`部分草稿无法读取：${String(cause)}`);
    }
  }
  async function reload(id: string) {
    const doc = documents.find(id);
    if (!doc?.path) return;
    if (pathBusy(doc.path) || get(saving).has(id)) return;
    if (
      dirty(doc) &&
      !(await confirm('重新载入会替换此标签的未保存内容，是否继续？', { title: '重新载入', kind: 'warning' }))
    )
      return;
    const version = doc.version;
    try {
      const file = await api.openDocument(doc.path);
      if (sameDiskState(documents.find(id), doc) && documents.find(id)?.version === version) {
        documents.reload(id, file);
        scheduleDraft(id);
      }
    } catch (cause) {
      await error(cause);
    }
  }
  function sameDiskState(current: DocumentSession | undefined, captured: DocumentSession) {
    return Boolean(
      current &&
      current.path === captured.path &&
      current.revision === captured.revision &&
      !pathBusy(current.path) &&
      !get(saving).has(current.id)
    );
  }
  async function checkExternal(changed?: string[]) {
    if (disposed) return;
    if (checking) {
      checkAgain = true;
      return;
    }
    checking = true;
    try {
      const tabs = documents
        .snapshot()
        .tabs.filter(
          (doc) =>
            doc.path &&
            !pathBusy(doc.path) &&
            !get(saving).has(doc.id) &&
            (!changed ||
              changed.some((path) => pathKey(path) === pathKey(doc.path) || isWithin(doc.path, path)))
        );
      if (!tabs.length) return;
      const revisions = await api.documentVersions(tabs.map((doc) => doc.path));
      for (const [path, revision] of revisions) {
        const captured = tabs.find((doc) => pathKey(doc.path) === pathKey(path));
        const doc = captured && documents.find(captured.id);
        if (
          !doc ||
          !sameDiskState(doc, captured!) ||
          (doc.revision?.hash === revision?.hash && doc.revision?.modified === revision?.modified)
        )
          continue;
        if (dirty(doc) || !revision) documents.patch(doc.id, { externalChanged: true, missing: !revision });
        else {
          const version = doc.version;
          try {
            const file = await api.openDocument(doc.path);
            const current = documents.find(doc.id);
            if (!sameDiskState(current, doc)) continue;
            if (current?.version === version && !dirty(current)) documents.reload(doc.id, file);
            else if (current) documents.patch(doc.id, { externalChanged: true });
          } catch {
            if (sameDiskState(documents.find(doc.id), doc))
              documents.patch(doc.id, { externalChanged: true, missing: true });
          }
        }
      }
    } catch (cause) {
      status.set(`外部变更检查失败：${String(cause)}`);
    } finally {
      checking = false;
      if (checkAgain) {
        checkAgain = false;
        void checkExternal();
      }
    }
  }
  async function handleChanges(paths: string[]) {
    const affected = expandedPaths().filter((dir) =>
      paths.some((path) => pathKey(parentPath(path)) === pathKey(dir) || pathKey(path) === pathKey(dir))
    );
    await Promise.all(affected.map(refreshDirectory));
    await checkExternal(paths);
  }

  function cancelSearch() {
    const id = search.snapshot().requestId;
    if (id) void api.cancelScan(id);
    search.cancel();
  }
  async function startSearch(kind: 'files' | 'headings') {
    const root = workspace.snapshot().root;
    if (!root) return;
    cancelSearch();
    const requestId = crypto.randomUUID();
    search.begin(root, kind, requestId);
    try {
      await api.scanWorkspace(root, kind, get(preferences).excludes, requestId, search.batch);
    } catch (cause) {
      search.fail(requestId, String(cause));
    }
  }
  function localSearchItems(): SearchItem[] {
    const paths = [
      ...documents
        .snapshot()
        .tabs.filter((doc) => doc.path)
        .map((doc) => doc.path),
      ...get(preferences).recent,
      ...Object.values(workspace.snapshot().directories).flatMap((dir) =>
        dir.entries.filter((e) => e.kind === 'file').map((e) => e.path)
      )
    ];
    return [...new Set(paths)].map((path) => ({ path, label: filename(path), detail: path }));
  }

  function validName(name: string) {
    return (
      name && name !== '.' && name !== '..' && !/[<>:"/\\|?*\u0000-\u001f]/.test(name) && !/[. ]$/.test(name)
    );
  }
  async function newFolder(parent = workspace.snapshot().root) {
    if (!parent) return;
    const name = await askName('新建文件夹', '新文件夹');
    if (!name) return;
    try {
      if (!validName(name)) throw new Error('文件夹名称包含无效字符');
      await api.createFolder(childPath(parent, name));
      await refreshDirectory(parent);
    } catch (cause) {
      await error(cause);
    }
  }
  async function newFile(parent = workspace.snapshot().root) {
    if (!parent) return createDocument();
    const name = await askName('新建 Markdown 文件', '未命名.md');
    if (!name) return;
    const creationId = crypto.randomUUID();
    try {
      if (!validName(name)) throw new Error('文件名包含无效字符');
      const path = childPath(parent, /\.(md|markdown)$/i.test(name) ? name : `${name}.md`);
      if (pathBusy(path)) throw new Error('目标目录正在移动或删除，请稍后新建文件');
      const generation = ++openGeneration;
      if ([...saveTargets.values()].some((target) => pathKey(target) === pathKey(path)))
        throw new Error('目标文件正在保存，请稍后重试');
      saveTargets.set(creationId, path);
      const reply = await api.saveDocument({
        path,
        content: '',
        encoding: 'UTF-8',
        bom: false,
        newline: 'lf',
        expected: null
      });
      if (!reply.file) throw new Error(reply.message || '无法创建文件');
      const id = documents.open(reply.file, generation === openGeneration);
      documents.patch(id, { mode: 'edit' });
      remember(reply.file.path);
      await refreshDirectory(parent);
      updateWatches();
    } catch (cause) {
      await error(cause);
    } finally {
      saveTargets.delete(creationId);
    }
  }
  async function mutate(entry: DirectoryEntry, action: 'rename' | 'move' | 'trash') {
    if (operationPending) {
      status.set('请先完成当前文件操作');
      return;
    }
    operationPending = true;
    try {
      let target = '';
      if (action === 'rename') {
        const name = await askName('重命名', entry.name);
        if (!name || name === entry.name) return;
        if (!validName(name)) throw new Error('名称包含无效字符');
        target = childPath(parentPath(entry.path), name);
      }
      if (action === 'move') {
        const folder = await open({ directory: true, title: '移动到文件夹' });
        if (typeof folder !== 'string') return;
        target = childPath(folder, entry.name);
      }
      if (action === 'trash') {
        if (!(await confirm(`将“${entry.name}”移入回收站？`, { title: '移入回收站', kind: 'warning' })))
          return;
        const decisions = new Map<string, number>();
        for (const doc of documents
          .snapshot()
          .tabs.filter((doc) => doc.path && isWithin(doc.path, entry.path))) {
          if (!(await prepareClose(doc.id))) return;
          decisions.set(doc.id, documents.find(doc.id)?.version ?? -1);
        }
        if (
          documents
            .snapshot()
            .tabs.some(
              (doc) => doc.path && isWithin(doc.path, entry.path) && decisions.get(doc.id) !== doc.version
            )
        ) {
          status.set('文档又有新的编辑，已取消移入回收站');
          return;
        }
      }
      const affected = documents.snapshot().tabs.filter((doc) => doc.path && isWithin(doc.path, entry.path));
      if (
        affected.some((doc) => get(saving).has(doc.id)) ||
        [...saveTargets.values()].some(
          (path) => isWithin(path, entry.path) || (target && isWithin(path, target))
        )
      )
        throw new Error('文件正在保存，请保存完成后再操作');
      changingPaths.add(entry.path);
      invalidatePendingOpens(entry.path);
      if (target) {
        changingPaths.add(target);
        invalidatePendingOpens(target);
      }
      await flushDrafts();
      if (action === 'trash') {
        await api.trashPath(entry.path);
        for (const doc of affected) {
          clearTimeout(draftTimers.get(doc.id));
          await draftQueue.run(draftKey(doc), () => api.deleteDraft(draftKey(doc)));
          if (documents.find(doc.id)?.version !== doc.version) {
            documents.patch(doc.id, { missing: true, externalChanged: true });
            scheduleDraft(doc.id);
          } else documents.close(doc.id);
        }
        setPreferences({
          ...get(preferences),
          recent: get(preferences).recent.filter((path) => !isWithin(path, entry.path))
        });
      } else {
        const path = await api.movePath(entry.path, target);
        changingPaths.add(path);
        documents.remap(entry.path, path);
        setPreferences({
          ...get(preferences),
          recent: get(preferences).recent.map((old) =>
            isWithin(old, entry.path) ? path + old.slice(entry.path.length) : old
          )
        });
        if (isWithin(workspace.snapshot().root, entry.path))
          workspace.setRoot(path + workspace.snapshot().root.slice(entry.path.length));
        for (const old of affected) {
          const current = documents.find(old.id);
          if (!current) continue;
          try {
            await draftQueue.run(draftKey(old), () => api.moveDraft(draftKey(old), draftKey(current)));
          } catch {
            status.set('文件已移动；原草稿保留，正在为新路径重新保存草稿');
          }
          if (dirty(current)) scheduleDraft(current.id);
        }
      }
      workspace.invalidate(entry.path);
      if (action === 'trash' && isWithin(workspace.snapshot().root, entry.path)) workspace.setRoot('');
      changingPaths.clear();
      cancelSearch();
      search.reset();
      await refreshVisible();
      updateWatches();
      status.set('文件操作已完成');
    } catch (cause) {
      await error(cause);
    } finally {
      changingPaths.clear();
      operationPending = false;
    }
  }
  function dispose() {
    disposed = true;
    cancelSearch();
    for (const timer of draftTimers.values()) clearTimeout(timer);
    for (const dir of Object.values(workspace.snapshot().directories))
      if (dir.loading) void api.cancelScan(dir.requestId);
    void api.watchWorkspace([]);
    resolvePrompt(null);
  }
  return {
    documents,
    workspace,
    search,
    preferences,
    status,
    saving,
    prompt,
    setPreferences,
    resolvePrompt,
    activate,
    error,
    openFile,
    openPath,
    openWorkspace,
    restoreLastWorkspace,
    chooseFiles,
    chooseWorkspace,
    createDocument,
    toggleDirectory,
    refreshDirectory,
    refreshVisible,
    edit,
    scheduleDraft,
    saveTab,
    closeTab,
    closeAll,
    flushDrafts,
    restoreUntitled,
    reload,
    checkExternal,
    handleChanges,
    startSearch,
    cancelSearch,
    localSearchItems,
    newFile,
    newFolder,
    mutate,
    dispose
  };
}
