export type ShellPreferences = {
  leftWidth: number;
  rightWidth: number;
  leftClosed: boolean;
  rightClosed: boolean;
  autoWrite: boolean;
  excludes: string[];
  recent: string[];
};
const KEY = 'md-view-shell-v2';
const defaults: ShellPreferences = {
  leftWidth: 250,
  rightWidth: 220,
  leftClosed: false,
  rightClosed: false,
  autoWrite: false,
  excludes: [],
  recent: []
};
export function shellPreferencesDefaults(): ShellPreferences {
  return { ...defaults };
}

export function loadShellPreferences(): ShellPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      ...defaults,
      ...saved,
      autoWrite: saved.autoWrite === true,
      leftWidth: Math.min(460, Math.max(180, Number(saved.leftWidth) || 250)),
      rightWidth: Math.min(400, Math.max(180, Number(saved.rightWidth) || 220)),
      excludes: Array.isArray(saved.excludes)
        ? saved.excludes.filter((x: unknown) => typeof x === 'string')
        : [],
      recent: Array.isArray(saved.recent)
        ? saved.recent.filter((x: unknown) => typeof x === 'string').slice(0, 50)
        : []
    };
  } catch {
    return { ...defaults };
  }
}
export function saveShellPreferences(value: ShellPreferences) {
  localStorage.setItem(KEY, JSON.stringify(value));
}
export function rememberFile(value: ShellPreferences, path: string) {
  return { ...value, recent: [path, ...value.recent.filter((p) => p !== path)].slice(0, 50) };
}
