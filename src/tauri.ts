import { invoke } from '@tauri-apps/api/core';
import type {
  DraftContent,
  DraftSummary,
  FileNode,
  Heading,
  LinkValidationRequest,
  LinkValidationResult,
  OpenPathResult,
  ReadFileResult,
  SaveResult,
  WorkspaceHeading
} from './types';

export function openWorkspace(path: string): Promise<FileNode> {
  return invoke('open_workspace', { path });
}

export function openPath(path: string): Promise<OpenPathResult> {
  return invoke('open_path', { path });
}

export function readFile(path: string): Promise<ReadFileResult> {
  return invoke('read_file', { path });
}

export function saveFile(path: string, content: string, expected: number | null, overwrite: boolean): Promise<SaveResult> {
  return invoke('save_file', { path, content, expected, overwrite });
}

export function extractOutline(content: string): Promise<Heading[]> {
  return invoke('extract_outline', { content });
}

export function writeDraft(path: string, content: string): Promise<DraftSummary> {
  return invoke('write_draft', { path, content });
}

export function readDraft(path: string): Promise<DraftContent | null> {
  return invoke('read_draft', { path });
}

export function deleteDraft(path: string): Promise<boolean> {
  return invoke('delete_draft', { path });
}

export function listDrafts(workspace: string): Promise<DraftSummary[]> {
  return invoke('list_drafts', { workspace });
}

export function clearWorkspaceDrafts(workspace: string): Promise<number> {
  return invoke('clear_workspace_drafts', { workspace });
}

export function initialOpenPaths(): Promise<string[]> {
  return invoke('initial_open_paths');
}

export function openDefaultAppSettings(): Promise<void> {
  return invoke('open_default_app_settings');
}

export function openExternalUrl(url: string): Promise<void> {
  return invoke('open_external_url', { url });
}

export function validateLocalLinks(path: string, links: LinkValidationRequest[]): Promise<LinkValidationResult[]> {
  return invoke('validate_local_links', { markdownPath: path, links });
}

export function indexWorkspaceHeadings(workspace: string): Promise<WorkspaceHeading[]> {
  return invoke('index_workspace_headings', { workspace });
}

export function exportHtml(path: string, html: string): Promise<void> {
  return invoke('export_html', { path, html });
}
