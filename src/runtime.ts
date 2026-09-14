export const runtimeTarget = import.meta.env.VITE_MD_VIEW_TARGET === 'web' ? 'web' : 'desktop';
export const isWebRuntime = runtimeTarget === 'web';

// 运行时桥按构建目标由别名 #runtime-bridge 解析：
// web 构建指向 web 桥（不含 Tauri api，链接校验退化为全通过），
// 桌面构建直接转发 Tauri 命令。避免运行时动态 import 与静态 import
// 混用导致的打包告警，也保证 web 包不引入桌面模块。
export { openExternalUrl, validateLocalLinks } from '#runtime-bridge';
