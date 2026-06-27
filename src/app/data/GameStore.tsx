import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Game } from '../types/game';
import { games as defaultGames } from '../data/games';
import { isInTauriLauncher, isOfflineMode } from '../utils/externalLink';

/**
 * Disk-based cache of the games catalogue, written through the native bridge
 * (see GoopieLauncher's getCachedGamesData/setCachedGamesData) on every
 * successful Firestore fetch. It's the offline fallback: the embedded offline
 * site is served from a different origin than goopie.xyz, so it can't share
 * localStorage with the live site — but both share the injected bridge.
 */
function readGamesCache(): Game[] | null {
  const w = window as any;
  if (typeof w.getCachedGamesData !== 'function') return null;
  const cached = w.getCachedGamesData();
  return cached && Array.isArray(cached.games) ? (cached.games as Game[]) : null;
}

function writeGamesCache(games: Game[]): void {
  const w = window as any;
  if (typeof w.setCachedGamesData !== 'function') return;
  w.setCachedGamesData({ lastUpdated: new Date().toISOString(), games });
}

interface GameStoreContextType {
  games: Game[];
  getGame: (id: string) => Game | undefined;
  saveGame: (game: Game) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  getVisibleGames: (userRole: string | undefined, assignedGames: string[]) => Game[];
  uploadImage: (file: File, path: string) => Promise<string>;
}

const GameStoreContext = createContext<GameStoreContextType | null>(null);

const GAMES_COLLECTION = 'games';

/**
 * The disk cache as of mount, read once up front so the very first render
 * already has data to show. Without this, a fresh page load (e.g. navigating
 * into the embedded offline bundle) starts with `firestoreGames = []` and
 * `loaded = false` — and if Firestore's `onSnapshot` never settles (no
 * network, no local IndexedDB persistence configured, so it just queues
 * silently instead of calling the error callback), the library stays on
 * `defaultGames`, which is an empty array, i.e. "all games disappeared".
 */
function initialCachedGames(): Game[] | null {
  return isInTauriLauncher() ? readGamesCache() : null;
}

export function GameStoreProvider({ children }: { children: ReactNode }) {
  const [firestoreGames, setFirestoreGames] = useState<Game[]>(() => initialCachedGames() ?? []);
  const [loaded, setLoaded] = useState(() => initialCachedGames() !== null);

  // Listen to Firestore games collection in real-time. Skipped entirely in
  // explicit offline mode — the SDK has no way to know in advance that the
  // listener will never connect, so it just queues silently (no error
  // callback, console spam from repeated `firestore.googleapis.com`
  // resolution failures) and would otherwise race with / clobber the
  // cache-seeded initial state above once it eventually does connect.
  useEffect(() => {
    if (isOfflineMode()) return;
    const unsub = onSnapshot(collection(db, GAMES_COLLECTION), (snapshot) => {
      const games = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Game));
      setFirestoreGames(games);
      setLoaded(true);
      if (isInTauriLauncher()) writeGamesCache(games);
    }, () => {
      // Firestore unreachable (e.g. offline, or no Firebase config yet).
      // In the launcher, fall back to the last cache written on a successful
      // fetch; otherwise fall back to the bundled defaults.
      if (isInTauriLauncher()) {
        const cached = readGamesCache();
        if (cached) setFirestoreGames(cached);
      }
      setLoaded(true);
    });
    return unsub;
  }, []);

  // Merge: Firestore games override defaults by ID, plus any Firestore-only games
  const games = (() => {
    if (!loaded) return defaultGames;
    const firestoreIds = new Set(firestoreGames.map(g => g.id));
    const merged = defaultGames.map(game => {
      const override = firestoreGames.find(g => g.id === game.id);
      return override ? { ...game, ...override } : { ...game, isPublic: game.isPublic ?? true };
    });
    const custom = firestoreGames.filter(g => !defaultGames.some(d => d.id === g.id));
    return [...merged, ...custom];
  })();

  const getGame = useCallback((id: string) => {
    return games.find(g => g.id === id);
  }, [games]);

  const saveGame = useCallback(async (game: Game) => {
    const stripUndefined = (obj: unknown): unknown => {
      if (Array.isArray(obj)) return obj.map(stripUndefined);
      if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, stripUndefined(v)])
        );
      }
      return obj;
    };
    const cleaned = stripUndefined(game);
    await setDoc(doc(db, GAMES_COLLECTION, game.id), cleaned);
  }, []);

  const deleteGame = useCallback(async (id: string) => {
    await deleteDoc(doc(db, GAMES_COLLECTION, id));
  }, []);

  const getVisibleGames = useCallback((userRole: string | undefined, assignedGames: string[]) => {
    return games.filter(game => {
      // Unplayable games are only visible to admins and assigned developers.
      if (game.status === 'Unplayable') {
        if (userRole === 'admin') return true;
        if (userRole === 'developer' && assignedGames.includes(game.id)) return true;
        return false;
      }
      if (game.isPublic !== false) return true;
      if (userRole === 'admin') return true;
      if (userRole === 'developer' && assignedGames.includes(game.id)) return true;
      return false;
    });
  }, [games]);

  const uploadImage = useCallback(async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }, []);

  return (
    <GameStoreContext.Provider value={{ games, getGame, saveGame, deleteGame, getVisibleGames, uploadImage }}>
      {children}
    </GameStoreContext.Provider>
  );
}

export function useGameStore() {
  const ctx = useContext(GameStoreContext);
  if (!ctx) throw new Error('useGameStore must be used within GameStoreProvider');
  return ctx;
}
