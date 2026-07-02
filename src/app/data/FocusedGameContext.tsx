import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * The `recompName` of whichever game the user currently has open/selected in
 * the Library (or `null` when no game is focused — e.g. no games loaded yet).
 *
 * The global drag-and-drop handler (`FileDropManager`) is mounted above the
 * router so it can react to a drop no matter which screen is showing, but it
 * has no way to read `Library`'s local `selectedGameId` state directly —
 * `Library` publishes it here instead so the drop handler knows which game
 * (if any) a dropped update/DLC file should apply to.
 */
interface FocusedGameContextType {
  focusedGame: string | null;
  setFocusedGame: (recompName: string | null) => void;
}

const FocusedGameContext = createContext<FocusedGameContextType | null>(null);

export function FocusedGameProvider({ children }: { children: ReactNode }) {
  const [focusedGame, setFocusedGameState] = useState<string | null>(null);
  const setFocusedGame = useCallback((recompName: string | null) => {
    setFocusedGameState(recompName);
  }, []);

  return (
    <FocusedGameContext.Provider value={{ focusedGame, setFocusedGame }}>
      {children}
    </FocusedGameContext.Provider>
  );
}

export function useFocusedGame() {
  const ctx = useContext(FocusedGameContext);
  if (!ctx) throw new Error('useFocusedGame must be used within FocusedGameProvider');
  return ctx;
}
