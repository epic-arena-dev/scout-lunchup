/**
 * // Mini-program config — injected via Taro defineConstants
 */
// @ts-ignore - API_BASE �� Taro defineConstants ע��
const GLOBAL_API_BASE: string = typeof API_BASE !== 'undefined' ? API_BASE : 'https://ai.epicarena.cn';

export const API_BASE = GLOBAL_API_BASE;
