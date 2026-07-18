import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './auth/AuthContext';
import { GameStoreProvider } from './data/GameStore';
import { LauncherUpdateProvider } from './data/LauncherUpdateContext';
import { FocusedGameProvider } from './data/FocusedGameContext';
import { ThemeProvider } from './theme/ThemeContext';
import { BackgroundAccentProvider } from './theme/BackgroundAccentContext';
import { ThemeBackground } from './components/ThemeBackground';
import { FpsCounter } from './components/FpsCounter';
import { FileDropManager } from './components/FileDropManager';

const LAST_ROUTE_KEY = 'goopie:lastRoute';

// Persist the current hash route on every navigation so the app can reopen
// on the last-viewed page next launch (see RootRoute in routes.tsx). Listens
// to `hashchange` directly rather than via a router hook so it works outside
// the RouterProvider tree.
function useLastRoutePersistence() {
  useEffect(() => {
    const persist = () => {
      const path = window.location.hash.replace(/^#/, '') || '/';
      try {
        localStorage.setItem(LAST_ROUTE_KEY, path);
      } catch {
        /* ignore quota / privacy errors */
      }
    };
    persist();
    window.addEventListener('hashchange', persist);
    return () => window.removeEventListener('hashchange', persist);
  }, []);
}

export default function App() {
  useLastRoutePersistence();
  return (
    <ThemeProvider>
      <BackgroundAccentProvider>
        <AuthProvider>
          <GameStoreProvider>
            <LauncherUpdateProvider>
              <FocusedGameProvider>
                <ThemeBackground />
                <RouterProvider router={router} />
                <FpsCounter />
                <FileDropManager />
              </FocusedGameProvider>
            </LauncherUpdateProvider>
          </GameStoreProvider>
        </AuthProvider>
      </BackgroundAccentProvider>
    </ThemeProvider>
  );
}