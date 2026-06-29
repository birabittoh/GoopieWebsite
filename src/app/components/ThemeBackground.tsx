import { lazy, Suspense } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useBackgroundAccent } from '../theme/BackgroundAccentContext';

// Lazy-load each background so only the active theme's canvas code is shipped
// to the user on first paint.
const BladesBackground = lazy(() =>
  import('./BladesBackground').then(m => ({ default: m.BladesBackground }))
);
const PeaceBackground = lazy(() =>
  import('./PeaceBackground').then(m => ({ default: m.PeaceBackground }))
);
const AquaBackground = lazy(() =>
  import('./AquaBackground').then(m => ({ default: m.AquaBackground }))
);
const XMBBackground = lazy(() =>
  import('./XMBBackground').then(m => ({ default: m.XMBBackground }))
);
const ParticleBackground = lazy(() =>
  import('./ParticleBackground').then(m => ({ default: m.ParticleBackground }))
);
const WiiBackground = lazy(() =>
  import('./WiiBackground').then(m => ({ default: m.WiiBackground }))
);
const GothicBackground = lazy(() =>
  import('./GothicBackground').then(m => ({ default: m.GothicBackground }))
);
const EmbersBackground = lazy(() =>
  import('./EmbersBackground').then(m => ({ default: m.EmbersBackground }))
);
const SpaceBackground = lazy(() =>
  import('./SpaceBackground').then(m => ({ default: m.SpaceBackground }))
);
const SunnyBackground = lazy(() =>
  import('./SunnyBackground').then(m => ({ default: m.SunnyBackground }))
);
const ToyBackground = lazy(() =>
  import('./ToyBackground').then(m => ({ default: m.ToyBackground }))
);
const MatrixBackground = lazy(() =>
  import('./MatrixBackground').then(m => ({ default: m.MatrixBackground }))
);

/**
 * Renders the canvas/SVG background for the current theme. Mounted once at the
 * app root so canvases survive route changes (no flicker / RAF teardown).
 *
 * Pages that need the per-game accent color (Blades / XMB) should call
 * `useBackgroundAccent().setAccentColor(...)` from a `useEffect`.
 */
export function ThemeBackground() {
  const { theme } = useTheme();
  const { accentColor } = useBackgroundAccent();

  let inner: React.ReactNode = null;
  switch (theme) {
    case 'blades':
      inner = <BladesBackground color={accentColor} />;
      break;
    case 'peace':
      inner = <PeaceBackground />;
      break;
    case 'aqua':
      inner = <AquaBackground />;
      break;
    case 'xmb':
      inner = <XMBBackground color={accentColor} />;
      break;
    case 'steam':
      inner = <ParticleBackground />;
      break;
    case 'wii':
      inner = <WiiBackground />;
      break;
    case 'gothic':
      inner = <GothicBackground />;
      break;
    case 'embers':
      inner = <EmbersBackground />;
      break;
    case 'space':
      inner = <SpaceBackground />;
      break;
    case 'sunny':
      inner = <SunnyBackground />;
      break;
    case 'toy':
      inner = <ToyBackground />;
      break;
    case 'matrix':
      inner = <MatrixBackground />;
      break;
    default:
      inner = null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1, backgroundColor: 'var(--theme-page-bg)' }}
    >
      <Suspense fallback={null}>{inner}</Suspense>
    </div>
  );
}
