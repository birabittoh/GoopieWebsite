import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface GameDeveloper {
  uid: string;
  username: string;
  picture?: string;
}

export function useGameDevelopers(gameId: string | undefined): GameDeveloper[] {
  const [developers, setDevelopers] = useState<GameDeveloper[]>([]);

  useEffect(() => {
    if (!gameId) { setDevelopers([]); return; }
    const q = query(collection(db, 'users'), where('assignedGames', 'array-contains', gameId));
    getDocs(q)
      .then(snap => {
        setDevelopers(
          snap.docs.map(d => {
            const data = d.data();
            return { uid: d.id, username: data.username as string, picture: (data.picture as string) || undefined };
          }),
        );
      })
      .catch(() => setDevelopers([]));
  }, [gameId]);

  return developers;
}
