export const appearanceModes = ['light','dark','plaid'] as const;
export type Appearance = typeof appearanceModes[number];
export const appearanceKey = 'bearagon-appearance';
export function validAppearance(value:unknown):Appearance { return appearanceModes.includes(value as Appearance)?value as Appearance:'light'; }
// Runs before the body paints; storage may be unavailable in private contexts.
export const appearanceBootstrap = `(function(){try{var m=localStorage.getItem('bearagon-appearance');document.documentElement.dataset.appearance=['light','dark','plaid'].includes(m)?m:'light';document.documentElement.dataset.ambient=localStorage.getItem('bearagon-ambient')==='off'?'off':'on';}catch(e){document.documentElement.dataset.appearance='light';}})();`;
