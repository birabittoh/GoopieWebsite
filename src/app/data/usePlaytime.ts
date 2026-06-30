import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, increment, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface GamePlaytime {
  totalSeconds: number;
  lastPlayedAt?: Date;
}

type PlaytimeGames = Record<string, { totalSeconds?: number; lastPlayedAt?: Timestamp }>;

/**
 * Records per-game playtime to `playtime/{uid}` as
 * `{ uid, games: { [gameId]: { totalSeconds, lastPlayedAt } } }`, and exposes
 * a read-back getter for displaying it (e.g. on a game's page).
 *
 * Deliberately never writes a `public` field: the doc — and therefore each
 * user's playtime — is private by default (see firestore.rules), and a future
 * "make my playtime public" toggle can set `public: true` without this hook
 * ever clobbering it back to false.
 */
export function usePlaytime(userId: string | undefined) {
  const userIdRef = useRef<string | undefined>(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const [games, setGames] = useState<PlaytimeGames>({});

  useEffect(() => {
    if (!userId) {
      setGames({});
      return;
    }
    const ref = doc(db, 'playtime', userId);
    const unsub = onSnapshot(
      ref,
      snapshot => {
        const data = snapshot.data();
        setGames((data?.games as PlaytimeGames) || {});
      },
      () => { /* ignore (e.g. offline / no firebase config) */ },
    );
    return unsub;
  }, [userId]);

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

  const getPlaytime = useCallback((gameId: string): GamePlaytime | null => {
    const entry = games[gameId];
    if (!entry || !entry.totalSeconds) return null;
    return {
      totalSeconds: entry.totalSeconds,
      lastPlayedAt: entry.lastPlayedAt?.toDate(),
    };
  }, [games]);

  return { recordSession, getPlaytime };
}
