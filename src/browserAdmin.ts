/** Must stay in sync with server/browserAuth.js DEFAULT_BROWSER_ADMIN_PATH */
export const BROWSER_ADMIN_PATH = String(
  import.meta.env.VITE_BROWSER_ADMIN_PATH || '/ops-uztronix-x7m2',
).replace(/\/+$/, '') || '/ops-uztronix-x7m2';

export function isBrowserAdminRoute(pathname = window.location.pathname) {
  const path = String(pathname || '');
  return path === BROWSER_ADMIN_PATH || path.startsWith(`${BROWSER_ADMIN_PATH}/`);
}
