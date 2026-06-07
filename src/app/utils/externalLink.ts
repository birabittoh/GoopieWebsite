/**
 * Helpers for opening URLs outside the launcher's webview.
 *
 * Both launchers (Tauri and the legacy CEF one) inject a bridge function
 * `window.OpenExternalLink(url)` that asks the OS to open the URL in the
 * default browser.  Without it, `target="_blank"` links and `window.open`
 * are swallowed by the webview with no visible effect.
 *
 * Usage:
 *   import { isInLauncher, openExternal } from '../utils/externalLink';
 */

/** Returns true when the page is running inside any launcher (Tauri or CEF). */
export function isInLauncher(): boolean {
  return typeof (window as any).GetPlatform === 'function';
}

/**
 * Returns true when running inside the new Tauri/WebKit-based GoopieLauncher.
 * The legacy CEF launcher does not inject window.GoogleSignIn.
 */
export function isInTauriLauncher(): boolean {
  return typeof (window as any).GoogleSignIn === 'function';
}

/**
 * Returns true when the user has explicitly enabled offline mode in the
 * Tauri launcher (see `window.isOfflineMode` / GoopieLauncher's persisted
 * preference). Firestore-backed hooks should treat this as "don't even try
 * to subscribe" — not just "the network is currently down" — so the app
 * stops generating `firestore.googleapis.com` connection-error spam and the
 * disk-cache-seeded state isn't raced/overwritten by a live listener.
 */
export function isOfflineMode(): boolean {
  const w = window as any;
  return isInTauriLauncher() && typeof w.isOfflineMode === 'function' && Boolean(w.isOfflineMode());
}

/**
 * Open `url` in the system browser when inside a launcher, otherwise open a
 * new tab.  Safe to call from any component without a React hook.
 */
export function openExternal(url: string): void {
  const w = window as any;
  if (typeof w.GetPlatform === 'function' && typeof w.OpenExternalLink === 'function') {
    w.OpenExternalLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
