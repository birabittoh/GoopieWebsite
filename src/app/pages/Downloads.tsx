import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Sidebar, SIDEBAR_WIDTH_CLASS } from '../components/Sidebar';
import { Footer } from '../components/Footer';
import { openExternal } from '../utils/externalLink';

// Published release assets have stable, versionless names, so we can link
// straight at GitHub's "latest release" redirect instead of querying the API.
// .deb is not published (the launcher can only self-update a single portable
// executable/AppImage — see GoopieLauncher's release workflow).
const RELEASE_BASE = 'https://github.com/birabittoh/GoopieLauncher/releases/latest/download';
const WINDOWS_MSI_URL = `${RELEASE_BASE}/Goopie-Launcher-windows-x86_64.msi`;
const WINDOWS_EXE_URL = `${RELEASE_BASE}/Goopie-Launcher-windows-x86_64.exe`;
const WINDOWS_SETUP_EXE_URL = `${RELEASE_BASE}/Goopie-Launcher-windows-x86_64-setup.exe`;
const LINUX_APPIMAGE_URL = `${RELEASE_BASE}/Goopie-Launcher-linux-x86_64.AppImage`;
const LINUX_PORTABLE_URL = `${RELEASE_BASE}/Goopie-Launcher-linux-x86_64`;
const LINUX_ARM64_APPIMAGE_URL = `${RELEASE_BASE}/Goopie-Launcher-linux-aarch64.AppImage`;
const LINUX_ARM64_PORTABLE_URL = `${RELEASE_BASE}/Goopie-Launcher-linux-aarch64`;

function DownloadButton({ url, label }: { url: string; label: string }) {
  return (
    <button
      onClick={() => openExternal(url)}
      className="flex items-center justify-center gap-2 w-44 h-11 rounded-lg text-sm font-semibold shrink-0 transition-opacity hover:opacity-90"
      style={{
        background: `linear-gradient(to bottom right, var(--theme-gradient-from), var(--theme-gradient-to))`,
        color: 'var(--theme-text-primary)',
      }}
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  );
}

function DownloadLink({ url, label }: { url: string; label: string }) {
  return (
    <button
      onClick={() => openExternal(url)}
      className="flex items-center gap-2 text-sm hover:underline"
      style={{ color: 'var(--theme-text-secondary)' }}
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  );
}

export function Downloads() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isInCEF, setIsInCEF] = useState(false);

  useEffect(() => {
    setIsInCEF(typeof (window as any).GetPlatform === 'function');
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col ${SIDEBAR_WIDTH_CLASS}`}
      style={{ backgroundColor: 'var(--theme-page-bg)', color: 'var(--theme-text-primary)' }}
    >
      <Sidebar />
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isInCEF={isInCEF}
      />

      <section className="flex-1 px-4 md:px-10 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            Downloads
          </h1>
          <p
            className="text-sm md:text-base mb-10"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            Get the Goopie Launcher for your platform.
          </p>

          {/* Windows */}
          <div
            className="rounded-xl p-6 md:p-8 mb-6 border"
            style={{
              backgroundColor: 'var(--theme-card-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2
                className="text-xl md:text-2xl font-bold"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                Windows
              </h2>
              <div className="flex flex-wrap gap-3">
                <DownloadButton url={WINDOWS_MSI_URL} label="Setup" />
              </div>
            </div>
          </div>

          {/* Linux */}
          <div
            className="rounded-xl p-6 md:p-8 mb-6 border"
            style={{
              backgroundColor: 'var(--theme-card-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2
                className="text-xl md:text-2xl font-bold"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                Linux
              </h2>
              <div className="flex flex-wrap gap-3">
                <DownloadButton url={LINUX_APPIMAGE_URL} label="AppImage" />
              </div>
            </div>
          </div>

          {/* macOS */}
          <div
            className="rounded-xl p-6 md:p-8 mb-6 border"
            style={{
              backgroundColor: 'var(--theme-card-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2
                className="text-xl md:text-2xl font-bold"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                macOS
              </h2>
              <p
                className="text-sm"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                Coming soon.
              </p>
            </div>
          </div>

          {/* Other */}
          <div>
            <h2
              className="text-xl md:text-2xl font-bold mb-3"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              Other
            </h2>
            <div className="flex flex-col gap-2">
              <DownloadLink url={LINUX_ARM64_APPIMAGE_URL} label="Linux AppImage (arm64)" />
              <DownloadLink url={LINUX_PORTABLE_URL} label="Linux Portable" />
              <DownloadLink url={LINUX_ARM64_PORTABLE_URL} label="Linux Portable (arm64)" />
              <DownloadLink url={WINDOWS_EXE_URL} label="Windows Portable" />
              <DownloadLink url={WINDOWS_SETUP_EXE_URL} label="Windows Setup (alternative)" />
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
