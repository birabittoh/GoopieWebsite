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

export default function App() {
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