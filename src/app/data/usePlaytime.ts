import { useCallback, useEffect, useRef } from 'react';
import { doc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Records per-game playtime to `playtime/{uid}` as
 * `{ uid, games: { [gameId]: { totalSeconds, lastPlayedAt } } }`.
 *
 * Deliberately never writes a `public` field: the doc — and therefore each
 * user's playtime — is private by default (see firestore.rules), and a future
 * "make my playtime public" toggle can set `public: true` without this hook
 * ever clobbering it back to false.
 */
export function usePlaytime(userId: string | undefined) {
  const userIdRef = useRef<string | undefined>(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const recordSession = useCallback(async (gameId: string, seconds: number) => {
    const uid = userIdRef.current;
    if (!uid || !gameId || seconds <= 0) return;
    try {
      const ref = doc(db, 'playtime', uid);
      // Ensure the doc exists before `updateDoc` (which errors on missing docs).
      await setDoc(ref, { uid }, { merge: true });
      await updateDoc(ref, {
        [`games.${gameId}.totalSeconds`]: increment(Math.round(seconds)),
        [`games.${gameId}.lastPlayedAt`]: serverTimestamp(),
      });
    } catch {
      /* offline / no firebase config — playtime simply won't be recorded */
    }
  }, []);

  return { recordSession };
}
