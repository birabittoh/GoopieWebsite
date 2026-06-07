import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { isOfflineMode } from '../utils/externalLink';

export type SiteContentKey = 'homeTagline' | 'footerCopyright' | 'eula' | 'privacy';

/**
 * Subscribe to a single site-content document. Returns the raw data plus
 * helpers to save updates (admin-only — enforced by Firestore rules; the UI
 * also gates the editor behind `isAdmin`).
 */
export function useSiteContent<T extends Record<string, any>>(
  key: SiteContentKey,
  defaultValue: T,
) {
  const { user } = useAuth();
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // No disk cache for site content — explicit offline mode just means "use
    // the bundled defaults", and skipping the subscription avoids spamming
    // the console with `firestore.googleapis.com` connection-error retries.
    if (isOfflineMode()) {
      setValue(defaultValue);
      setLoaded(true);
      return;
    }
    const ref = doc(db, 'siteContent', key);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setValue({ ...defaultValue, ...(snap.data() as T) });
        } else {
          setValue(defaultValue);
        }
        setLoaded(true);
      },
      () => {
        setLoaded(true);
      },
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const save = useCallback(
    async (next: Partial<T>): Promise<string> => {
      if (!user || user.role !== 'admin') return 'Permission denied';
      try {
        await setDoc(doc(db, 'siteContent', key), { ...value, ...next }, { merge: true });
        return 'ok';
      } catch (err: any) {
        return err?.message || 'Failed to save';
      }
    },
    [key, user, value],
  );

  return { value, loaded, save, isAdmin: user?.role === 'admin' };
}
