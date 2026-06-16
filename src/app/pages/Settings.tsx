import { useState, useEffect } from 'react';
import { Check, ArrowLeft, FolderOpen, Globe, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router';
import { useTheme, type ThemeName } from '../theme/ThemeContext';
import { getFpsEnabled, setFpsEnabled } from '../components/FpsCounter';
import { isInTauriLauncher } from '../utils/externalLink';
import { getLauncherVersion, isLauncherVersionAtLeast } from '../utils/launcherVersion';

const languageOptions: { id: number; label: string }[] = [
  { id: 1, label: 'English' },
  { id: 2, label: '日本語 (Japanese)' },
  { id: 3, label: 'Deutsch (German)' },
  { id: 4, label: 'Français (French)' },
  { id: 5, label: 'Español (Spanish)' },
  { id: 6, label: 'Italiano (Italian)' },
  { id: 7, label: '한국어 (Korean)' },
  { id: 8, label: '中文 简体 (Chinese Simplified)' },
  { id: 9, label: 'Português (Portuguese)' },
  { id: 11, label: 'Polski (Polish)' },
  { id: 12, label: 'Русский (Russian)' },
  { id: 13, label: 'Svenska (Swedish)' },
  { id: 14, label: 'Türkçe (Turkish)' },
  { id: 15, label: 'Norsk Bokmål (Norwegian)' },
  { id: 16, label: 'Nederlands (Dutch)' },
  { id: 17, label: '中文 繁體 (Chinese Traditional)' },
];

const themeOptions: { id: ThemeName; label: string; description: string; preview: string }[] = [
  { id: 'steam', label: 'Steam', description: '', preview: '#1b2838' },
  //{ id: 'blades', label: 'Blades', description: '', preview: '#0a570a' },
  //{ id: 'peace', label: 'Peace', description: '', preview: '#2d0a3d' },
  { id: 'aqua', label: 'Aqua', description: '', preview: '#02334a' },
  { id: 'xmb', label: 'PS3', description: '', preview: '#1a0000' },
  { id: 'embers', label: 'Embers', description: '', preview: '#0a0000' },
  { id: 'space', label: 'Space', description: '', preview: '#0a0420' },
  { id: 'matrix', label: 'Hacker', description: '', preview: '#000000' },
  { id: 'sunny', label: 'Day', description: '', preview: '#7ec8ff' },
  { id: 'gothic', label: 'Night', description: '', preview: '#0a1230' },
  { id: 'toy', label: 'Shapes', description: '', preview: '#ffe4f1' },
];

interface ProtonInstall {
  name: string;
  path: string;
}

export function Settings() {
  const { theme, setTheme } = useTheme();
  const [gamesPath, setGamesPath] = useState('');
  const [userLanguage, setUserLanguage] = useState<number>(1);
  const [showFps, setShowFps] = useState<boolean>(() => getFpsEnabled());
  const [offline, setOffline] = useState<boolean | null>(null);
  const [reachable, setReachable] = useState(true);
  const launcherVersion = getLauncherVersion();
  const w = window as any;

  // Proton state — only populated on Linux launcher 1.3.0+.
  const isLinuxLauncher =
    isInTauriLauncher() &&
    isLauncherVersionAtLeast('1.3.0') &&
    typeof w.GetPlatform === 'function' &&
    w.GetPlatform() === 'Linux';
  const [protonInstalls, setProtonInstalls] = useState<ProtonInstall[]>([]);
  const [useProton, setUseProton] = useState<boolean>(true);
  const [selectedProton, setSelectedProton] = useState<string>('');

  useEffect(() => {
    if (w.GetGamesPath) {
      setGamesPath(w.GetGamesPath() || '');
    }
    if (w.GetLanguage) {
      const lang = w.GetLanguage();
      if (typeof lang === 'number' && lang > 0) {
        setUserLanguage(lang);
      }
    }
    if (typeof w.isOfflineMode === 'function') {
      setOffline(Boolean(w.isOfflineMode()));
    }
    if (isLinuxLauncher) {
      if (typeof w.getProtonInstallations === 'function') {
        const installs = w.getProtonInstallations();
        setProtonInstalls(Array.isArray(installs) ? installs : []);
      }
      if (typeof w.getUseProton === 'function') {
        setUseProton(Boolean(w.getUseProton()));
      }
      if (typeof w.getSelectedProton === 'function') {
        setSelectedProton(String(w.getSelectedProton() ?? ''));
      }
    }
  }, []);

  // goopie.xyz reachability is cached natively (a real probe can take seconds
  // to time out, and the bridge is synchronous) — poll the cheap cached flag
  // so "switch to online mode" can be greyed out while it'd just land on a
  // broken page.
  useEffect(() => {
    if (typeof w.isGoopieReachable !== 'function') return;
    const poll = () => setReachable(Boolean(w.isGoopieReachable()));
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const offlineModeDisabled = offline === true && !reachable;

  const handleToggleOfflineMode = () => {
    if (offline === null || offlineModeDisabled) return;
    if (typeof w.setOfflineMode === 'function') {
      w.setOfflineMode(!offline);
      setOffline(!offline);
    }
  };

  const handleSetGamesPath = () => {
    if (w.SetGamesPath) {
      w.SetGamesPath();
      // Re-read after setting
      setTimeout(() => {
        if (w.GetGamesPath) {
          setGamesPath(w.GetGamesPath() || '');
        }
      }, 500);
    }
  };

  const handleOpenGamesFolder = () => {
    if (w.OpenGamesFolder) {
      w.OpenGamesFolder();
    }
  };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
      {/* Uncomment and implement WiiBackground for animated Wii theme */}
      {/*
      {theme === 'wii' && (
        <div className="fixed inset-0 z-0">
          <WiiBackground />
        </div>
      )}
      */}

      {/* Header */}
      <div
        className="border-b relative z-10"
        style={{
          backgroundColor: 'var(--theme-topbar-bg)',
          borderColor: 'var(--theme-border)',
          backdropFilter: 'var(--theme-backdrop-blur)',
          WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
        }}
      >
        <div className="max-w-3xl mx-auto px-8 py-5 flex items-center gap-4">
          <Link
            to="/library"
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}
            title="Back to Library"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>Settings</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10 relative z-10 space-y-10">

        {/* Games Path Section */}
        <section>
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>Games Path</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--theme-text-muted)' }}>Choose where your games are stored on disk.</p>

          <div
            className="rounded-xl border-2 p-5 flex items-center justify-between gap-4"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-card-bg)',
              backdropFilter: 'var(--theme-backdrop-blur)',
              WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
            }}
          >
            <div className="min-w-0">
              <div className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>Current Path</div>
              <div
                className="font-mono text-sm truncate"
                style={{ color: 'var(--theme-text-primary)' }}
                title={gamesPath || 'Not set'}
              >
                {gamesPath || 'Not set'}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {w.OpenGamesFolder && gamesPath && (
                <button
                  onClick={handleOpenGamesFolder}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors border"
                  style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)', backgroundColor: 'var(--theme-item-default)' }}
                  title="Open games folder in file explorer"
                >
                  <FolderOpen className="w-4 h-4" />
                  Open
                </button>
              )}
              <button
                onClick={handleSetGamesPath}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors"
                style={{ backgroundColor: 'var(--theme-accent)' }}
              >
                <FolderOpen className="w-4 h-4" />
                Change
              </button>
            </div>
          </div>
        </section>

        {/* Language Section */}
        {w.GetLanguage && (
          <section>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>Language</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--theme-text-muted)' }}>Choose the language for recompiled games. (Some games dont support some languages)</p>

            <div
              className="rounded-xl border-2 p-5"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-card-bg)',
                backdropFilter: 'var(--theme-backdrop-blur)',
                WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Globe className="w-5 h-5" style={{ color: 'var(--theme-text-muted)' }} />
                <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                  {languageOptions.find(l => l.id === userLanguage)?.label || 'English'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {languageOptions.map(lang => {
                  const selected = userLanguage === lang.id;
                  return (
                    <button
                      key={lang.id}
                      onClick={() => {
                        setUserLanguage(lang.id);
                        if (w.SetLanguage) w.SetLanguage(lang.id);
                      }}
                      className="text-left rounded-lg border px-3 py-2 text-sm transition-all"
                      style={{
                        borderColor: selected ? 'var(--theme-accent)' : 'var(--theme-border)',
                        backgroundColor: selected ? 'var(--theme-item-selected)' : 'transparent',
                        color: 'var(--theme-text-primary)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{lang.label}</span>
                        {selected && (
                          <Check className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: 'var(--theme-accent)' }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Theme Section */}
        <section>
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>Theme</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--theme-text-muted)' }}>Choose the visual style for the launcher. More coming soon...</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {themeOptions.map(opt => {
              const selected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className="text-left rounded-xl border-2 p-5 transition-all"
                  style={{
                    borderColor: selected ? 'var(--theme-accent)' : 'var(--theme-border)',
                    backgroundColor: selected ? 'var(--theme-item-selected)' : 'var(--theme-card-bg)',
                    backdropFilter: 'var(--theme-backdrop-blur)',
                    WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg border"
                      style={{ backgroundColor: opt.preview, borderColor: 'var(--theme-border)' }}
                    />
                    {selected && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--theme-accent)' }}
                      >
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>{opt.label}</div>
                  <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{opt.description}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Offline Mode Section — only meaningful inside the Tauri
            launcher, which injects the isOfflineMode/setOfflineMode bridge
            (the legacy CEF launcher and the plain web build don't). */}
        {isInTauriLauncher() && offline !== null && (
          <section>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>Offline Mode</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--theme-text-muted)' }}>
              Keeps the launcher from talking to goopie.xyz at all; no news, ratings or
              site content is fetched, and your play sessions aren't logged to your profile.
            </p>

            <div
              className="rounded-xl border-2 p-5 flex items-center justify-between gap-4"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-card-bg)',
                backdropFilter: 'var(--theme-backdrop-blur)',
                WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
              }}
            >
              <div className="min-w-0 flex items-center gap-3">
                {offline ? (
                  <WifiOff className="w-5 h-5 shrink-0" style={{ color: 'var(--theme-text-muted)' }} />
                ) : (
                  <Wifi className="w-5 h-5 shrink-0" style={{ color: 'var(--theme-text-muted)' }} />
                )}
                <div className="min-w-0">
                  <div className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                    {offline ? 'Offline mode is on' : 'Offline mode is off'}
                  </div>
                  {offlineModeDisabled && (
                    <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                      goopie.xyz isn't reachable right now — can't switch to online mode.
                    </div>
                  )}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={offline}
                disabled={offlineModeDisabled}
                onClick={handleToggleOfflineMode}
                className="shrink-0 relative inline-flex items-center h-7 w-12 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: offline ? 'var(--theme-accent)' : 'var(--theme-item-default)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                <span
                  className="inline-block w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: offline ? 'translateX(22px)' : 'translateX(3px)' }}
                />
              </button>
            </div>
          </section>
        )}

        {/* Proton section — only shown on Linux launcher 1.3.0+ */}
        {isLinuxLauncher && (
          <section>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>Proton (Linux)</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--theme-text-muted)' }}>
              Proton lets you run Windows builds on Linux. Keep in mind, Proton has not been tested with
              every game and may cause issues with some titles.
            </p>

            {/* Use Proton toggle */}
            <div
              className="rounded-xl border-2 p-5 flex items-center justify-between gap-4"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-card-bg)',
                backdropFilter: 'var(--theme-backdrop-blur)',
                WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
              }}
            >
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                  Use Proton to run Windows builds
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                  Windows builds will appear in the library and launch via Proton.
                </div>
              </div>
              <button
                role="switch"
                aria-checked={useProton}
                onClick={() => {
                  const next = !useProton;
                  setUseProton(next);
                  if (typeof w.setUseProton === 'function') w.setUseProton(next);
                }}
                className="shrink-0 relative inline-flex items-center h-7 w-12 rounded-full transition-colors"
                style={{
                  backgroundColor: useProton ? 'var(--theme-accent)' : 'var(--theme-item-default)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                <span
                  className="inline-block w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: useProton ? 'translateX(22px)' : 'translateX(3px)' }}
                />
              </button>
            </div>

            {/* Proton installation selector — only when Proton is enabled */}
            {useProton && (
              <div
                className="rounded-xl border-2 p-5 mt-4"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-card-bg)',
                  backdropFilter: 'var(--theme-backdrop-blur)',
                  WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
                }}
              >
                <div className="font-semibold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                  Proton installation
                </div>
                {protonInstalls.length === 0 ? (
                  <div className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                    No Proton installations found. Install Proton through Steam (or a custom build
                    like GE-Proton) and reopen the launcher.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* "Automatic" option — use the newest detected installation */}
                    {(() => {
                      const isAuto = selectedProton === '';
                      return (
                        <button
                          key="__auto__"
                          onClick={() => {
                            setSelectedProton('');
                            if (typeof w.setSelectedProton === 'function') w.setSelectedProton('');
                          }}
                          className="text-left rounded-lg border px-3 py-2 text-sm transition-all"
                          style={{
                            borderColor: isAuto ? 'var(--theme-accent)' : 'var(--theme-border)',
                            backgroundColor: isAuto ? 'var(--theme-item-selected)' : 'transparent',
                            color: 'var(--theme-text-primary)',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">Automatic</span>
                              <div className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                                Use the newest detected installation
                              </div>
                            </div>
                            {isAuto && (
                              <Check className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: 'var(--theme-accent)' }} />
                            )}
                          </div>
                        </button>
                      );
                    })()}
                    {protonInstalls.map(install => {
                      const selected = selectedProton === install.path;
                      return (
                        <button
                          key={install.path}
                          onClick={() => {
                            setSelectedProton(install.path);
                            if (typeof w.setSelectedProton === 'function') w.setSelectedProton(install.path);
                          }}
                          className="text-left rounded-lg border px-3 py-2 text-sm transition-all"
                          style={{
                            borderColor: selected ? 'var(--theme-accent)' : 'var(--theme-border)',
                            backgroundColor: selected ? 'var(--theme-item-selected)' : 'transparent',
                            color: 'var(--theme-text-primary)',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="font-medium">{install.name}</span>
                              <div
                                className="text-xs mt-0.5 truncate"
                                style={{ color: 'var(--theme-text-muted)' }}
                                title={install.path}
                              >
                                {install.path}
                              </div>
                            </div>
                            {selected && (
                              <Check className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: 'var(--theme-accent)' }} />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Debug Section (FPS) */}
        <section>
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>Debug</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--theme-text-muted)' }}>Developer tools and overlays.</p>

          <div
            className="rounded-xl border-2 p-5 flex items-center justify-between gap-4"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-card-bg)',
              backdropFilter: 'var(--theme-backdrop-blur)',
              WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
            }}
          >
            <div className="min-w-0">
              <div className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>FPS Counter</div>
              <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                Show a frame-rate overlay in the top-right corner.
              </div>
            </div>
            <button
              role="switch"
              aria-checked={showFps}
              onClick={() => {
                const next = !showFps;
                setShowFps(next);
                setFpsEnabled(next);
              }}
              className="shrink-0 relative inline-flex items-center h-7 w-12 rounded-full transition-colors"
              style={{
                backgroundColor: showFps ? 'var(--theme-accent)' : 'var(--theme-item-default)',
                border: '1px solid var(--theme-border)',
              }}
            >
              <span
                className="inline-block w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: showFps ? 'translateX(22px)' : 'translateX(3px)' }}
              />
            </button>
          </div>

          {launcherVersion !== null && (
            <div
              className="rounded-xl border-2 p-5 flex items-center justify-between gap-4 mt-4"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-card-bg)',
                backdropFilter: 'var(--theme-backdrop-blur)',
                WebkitBackdropFilter: 'var(--theme-backdrop-blur)',
              }}
            >
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Launcher Version</div>
                <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                  Version of the GoopieLauncher app, for debugging.
                </div>
              </div>
              <div className="shrink-0 font-mono text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                {launcherVersion}
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
