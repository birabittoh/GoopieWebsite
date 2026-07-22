import { lazy, Suspense, type ComponentType } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import { Home } from './pages/Home';

// Lazy-load every route except Home (the landing page) so secondary screens
// ship as their own chunks.
const Library = lazy(() => import('./pages/Library').then(m => ({ default: m.Library })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Eula = lazy(() => import('./pages/Eula').then(m => ({ default: m.Eula })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const SaveManager = lazy(() => import('./pages/SaveManager').then(m => ({ default: m.SaveManager })));
const Installed = lazy(() => import('./pages/Installed').then(m => ({ default: m.Installed })));
const News = lazy(() => import('./pages/News').then(m => ({ default: m.News })));
const Externals = lazy(() => import('./pages/Externals').then(m => ({ default: m.Externals })));
const Favorites = lazy(() => import('./pages/Favorites').then(m => ({ default: m.Favorites })));
const Downloads = lazy(() => import('./pages/Downloads').then(m => ({ default: m.Downloads })));
const VehicleBrowser = lazy(() => import('./pages/VehicleBrowser').then(m => ({ default: m.VehicleBrowser })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const MarkdownReference = lazy(() => import('./pages/MarkdownReference').then(m => ({ default: m.MarkdownReference })));
const GameEditorPage = lazy(() => import('./pages/GameEditorPage').then(m => ({ default: m.GameEditorPage })));
const GameMods = lazy(() => import('./pages/GameMods').then(m => ({ default: m.GameMods })));

function isInCEF(): boolean {
  return typeof (window as any)?.GetPlatform === 'function';
}

const LAST_ROUTE_KEY = 'goopie:lastRoute';

function getLastRoute(): string | null {
  try {
    const path = localStorage.getItem(LAST_ROUTE_KEY);
    return path && path !== '/' ? path : null;
  } catch {
    return null;
  }
}

// Track whether we've already performed the initial redirect. We only want
// to bounce `/` → (the last-opened page, or `/library` inside the launcher)
// on the very first load; after that, the user is free to visit Home
// explicitly via the sidebar.
let initialRedirectDone = false;

function hasPendingAutoPlay(): boolean {
  const w = window as any;
  return typeof w.getAutoPlayGame === 'function' && !!w.getAutoPlayGame();
}

function RootRoute() {
  if (!initialRedirectDone) {
    initialRedirectDone = true;
    // A shortcut launch (`--play <game>`) always needs to land on Library,
    // since that's the only screen that reads the auto-play flag — otherwise
    // reopening on a stale `lastRoute` (e.g. Settings) silently drops it.
    if (hasPendingAutoPlay()) {
      return <Navigate to="/library" replace />;
    }
    const lastRoute = getLastRoute();
    if (lastRoute) {
      return <Navigate to={lastRoute} replace />;
    }
    if (isInCEF()) {
      return <Navigate to="/library" replace />;
    }
  }
  return <Home />;
}

function withSuspense(Component: ComponentType) {
  return function Lazy() {
    return (
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    );
  };
}

export const router = createHashRouter([
  {
    path: '/',
    Component: RootRoute,
  },
  {
    path: '/library',
    Component: withSuspense(Library),
  },
  {
    path: '/library/:recompName',
    Component: withSuspense(Library),
  },
  {
    path: '/login',
    Component: withSuspense(Login),
  },
  {
    path: '/profile',
    Component: withSuspense(Profile),
  },
  {
    path: '/settings',
    Component: withSuspense(Settings),
  },
  {
    path: '/eula',
    Component: withSuspense(Eula),
  },
  {
    path: '/privacy',
    Component: withSuspense(PrivacyPolicy),
  },
  {
    path: '/:recompName/saves',
    Component: withSuspense(SaveManager),
  },
  {
    path: '/installed',
    Component: withSuspense(Installed),
  },
  {
    path: '/news',
    Component: withSuspense(News),
  },
  {
    path: '/externals',
    Component: withSuspense(Externals),
  },
  {
    path: '/favorites',
    Component: withSuspense(Favorites),
  },
  {
    path: '/downloads',
    Component: withSuspense(Downloads),
  },
  {
    path: '/:recompName/vehicles',
    Component: withSuspense(VehicleBrowser),
  },
  {
    path: '/:recompName/mods/:modId?',
    Component: withSuspense(GameMods),
  },
  {
    path: '/markdown-reference',
    Component: withSuspense(MarkdownReference),
  },
  {
    path: '/game-editor',
    Component: withSuspense(GameEditorPage),
  },
  {
    path: '/game-editor/:recompName',
    Component: withSuspense(GameEditorPage),
  },
  {
    path: '/game-editor/:recompName/preview',
    Component: withSuspense(GameEditorPage),
  },
  {
    path: '*',
    Component: withSuspense(NotFound),
  },
]);
