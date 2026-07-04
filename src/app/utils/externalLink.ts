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
 * Returns true when running inside the Tauri GoopieLauncher on Linux.
 * The header image crossfade (opacity transition between two stacked <img>
 * layers) breaks on the Linux WebKitGTK webview, so callers use this to
 * fall back to a hard image swap instead.
 */
export function isTauriLinuxLauncher(): boolean {
  const w = window as any;
  return isInTauriLauncher() && typeof w.GetPlatform === 'function' && w.GetPlatform() === 'Linux';
}

/**
 * Memoized result of the last `window.isOfflineMode()` bridge call (see below).
 * `undefined` until first computed.
 */
let cachedOfflineMode: boolean | undefined;

/**
 * Returns true when the user has explicitly enabled offline mode in the
 * Tauri launcher (see `window.isOfflineMode` / GoopieLauncher's persisted
 * preference). Firestore-backed hooks should treat this as "don't even try
 * to subscribe" — not just "the network is currently down" — so the app
 * stops generating `firestore.googleapis.com` connection-error spam and the
 * disk-cache-seeded state isn't raced/overwritten by a live listener.
 *
 * `window.isOfflineMode` is a *synchronous* bridge call (blocking XHR — see
 * GoopieLauncher's `bridge/shim.js`), so we memoize the result for the life
 * of the page: the only way the effective mode changes is `setOfflineMode`,
 * which immediately navigates/reloads the window, so a stale cached value
 * can't outlive the mode it describes. Without this memo, callers that check
 * `isOfflineMode()` from a render path (e.g. `Sidebar`, which re-renders every
 * 1.5s and on every navigation) would each fire a blocking round-trip to Rust,
 * stalling the UI thread during scroll/navigation.
 */
export function isOfflineMode(): boolean {
  if (cachedOfflineMode !== undefined) return cachedOfflineMode;
  const w = window as any;
  cachedOfflineMode =
    isInTauriLauncher() && typeof w.isOfflineMode === 'function' && Boolean(w.isOfflineMode());
  return cachedOfflineMode;
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
