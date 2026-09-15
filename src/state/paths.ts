/** Path comparison and joining helpers shared by workspace, sessions and shell. */

export const filename = (path: string) => path.split(/[\\/]/).pop() || '未命名.md';

export const pathKey = (path: string) => {
  const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
  return /^[a-z]:\//i.test(normalized) || normalized.startsWith('//') ? normalized.toLowerCase() : normalized;
};

export const isWithin = (path: string, root: string) => {
  // 空 root 时不能用 startsWith('/') 误判绝对路径为“位于 root 下”。
  if (!root) return !path;
  const pathKeyNormalized = pathKey(path);
  const rootKey = pathKey(root);
  return pathKeyNormalized === rootKey || pathKeyNormalized.startsWith(`${rootKey}/`);
};

export const parentPath = (path: string) => {
  const parent = path.replace(/\\/g, '/').replace(/\/[^/]*$/, '') || '/';
  return /^[a-z]:$/i.test(parent) ? `${parent}/` : parent;
};

export const childPath = (parent: string, name: string) => `${parent.replace(/[\\/]$/, '')}/${name}`;
