export type ContentWidth = 'narrow' | 'medium' | 'wide' | 'full';
export type SoftBreakMode = 'commonmark' | 'breaks';
export type FrontmatterMode = 'properties' | 'raw' | 'hidden';
export type TocMode = 'render' | 'hidden';

export type PlusPreferences = {
  contentWidth: ContentWidth;
  fontScale: number;
  lineHeight: number;
  softBreakMode: SoftBreakMode;
  frontmatterMode: FrontmatterMode;
  tocMode: TocMode;
  mathEnabled: boolean;
  mermaidEnabled: boolean;
  mermaidControls: boolean;
  validateLocalLinks: boolean;
  syncScroll: boolean;
};

export const PLUS_PREFERENCES_STORAGE_KEY = 'md-view-plus-preferences-v1';

export const defaultPlusPreferences: PlusPreferences = {
  contentWidth: 'medium',
  fontScale: 100,
  lineHeight: 1.75,
  softBreakMode: 'commonmark',
  frontmatterMode: 'properties',
  tocMode: 'render',
  mathEnabled: true,
  mermaidEnabled: true,
  mermaidControls: true,
  validateLocalLinks: true,
  syncScroll: true
};

const widthMap: Record<ContentWidth, string> = {
  narrow: '760px',
  medium: '920px',
  wide: '1180px',
  full: '100%'
};

export function loadPlusPreferences(): PlusPreferences {
  if (typeof localStorage === 'undefined') return defaultPlusPreferences;
  const raw = localStorage.getItem(PLUS_PREFERENCES_STORAGE_KEY);
  if (!raw) return defaultPlusPreferences;
  try {
    return normalizePlusPreferences(JSON.parse(raw));
  } catch {
    return defaultPlusPreferences;
  }
}

export function savePlusPreferences(preferences: PlusPreferences) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PLUS_PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePlusPreferences(preferences)));
}

export function normalizePlusPreferences(value: Partial<PlusPreferences> | null | undefined): PlusPreferences {
  const next = { ...defaultPlusPreferences, ...(value ?? {}) };
  return {
    contentWidth: isContentWidth(next.contentWidth) ? next.contentWidth : defaultPlusPreferences.contentWidth,
    fontScale: clampNumber(next.fontScale, 85, 130, defaultPlusPreferences.fontScale),
    lineHeight: clampNumber(next.lineHeight, 1.45, 2, defaultPlusPreferences.lineHeight),
    softBreakMode: next.softBreakMode === 'breaks' ? 'breaks' : 'commonmark',
    frontmatterMode: isFrontmatterMode(next.frontmatterMode) ? next.frontmatterMode : defaultPlusPreferences.frontmatterMode,
    tocMode: next.tocMode === 'hidden' ? 'hidden' : 'render',
    mathEnabled: Boolean(next.mathEnabled),
    mermaidEnabled: Boolean(next.mermaidEnabled),
    mermaidControls: Boolean(next.mermaidControls),
    validateLocalLinks: Boolean(next.validateLocalLinks),
    syncScroll: Boolean(next.syncScroll)
  };
}

export function plusReaderStyle(preferences: PlusPreferences) {
  const safe = normalizePlusPreferences(preferences);
  return [
    `--reader-max-width: ${widthMap[safe.contentWidth]}`,
    `--reader-font-size: ${safe.fontScale}%`,
    `--reader-line-height: ${safe.lineHeight}`
  ].join('; ');
}

function isContentWidth(value: unknown): value is ContentWidth {
  return value === 'narrow' || value === 'medium' || value === 'wide' || value === 'full';
}

function isFrontmatterMode(value: unknown): value is FrontmatterMode {
  return value === 'properties' || value === 'raw' || value === 'hidden';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
