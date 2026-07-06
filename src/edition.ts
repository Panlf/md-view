export type AppEdition = 'lite' | 'plus';

export const appEdition: AppEdition = import.meta.env.VITE_MD_VIEW_EDITION === 'plus' ? 'plus' : 'lite';
export const appVersion = import.meta.env.VITE_MD_VIEW_VERSION ?? '';
export const isPlusEdition = appEdition === 'plus';
export const editionDisplayName = isPlusEdition ? 'md-view Plus' : 'md-view Lite';
export const plusMarkdownStatus = 'Plus Markdown';
