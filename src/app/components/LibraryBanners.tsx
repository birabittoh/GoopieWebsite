import { AlertTriangle, Info, X } from 'lucide-react';
import { Link } from 'react-router';

interface LibraryBannersProps {
  isLegacyLauncher: boolean;
  legacyBannerDismissed: boolean;
  onDismissLegacyBanner: () => void;
  infoBannerDismissed: boolean;
  onDismissInfoBanner: () => void;
  isInCEF: boolean;
  openExternal: (url: string) => void;
}

export function LibraryBanners({
  isLegacyLauncher,
  legacyBannerDismissed,
  onDismissLegacyBanner,
  infoBannerDismissed,
  onDismissInfoBanner,
  isInCEF,
  openExternal,
}: LibraryBannersProps) {
  return (
    <>
      {isLegacyLauncher && !legacyBannerDismissed && (
        <div className="bg-yellow-400 px-4 md:px-6 py-2 flex items-center justify-center gap-2 md:gap-3 relative z-10 text-center pr-8">
          <AlertTriangle className="w-4 h-4 text-yellow-950 shrink-0" />
          <span className="text-yellow-950 text-xs md:text-sm font-semibold leading-tight">
            A new, self-updating Goopie launcher is available.{' '}
            <a
              className="underline font-bold cursor-pointer hover:text-black"
              onClick={() => openExternal('https://goopie.xyz/downloads')}
            >
              Download it at goopie.xyz/downloads
            </a>
            . Please uninstall the old launcher before installing the new one.
          </span>
          <button
            onClick={onDismissLegacyBanner}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-yellow-950 hover:text-black transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {!infoBannerDismissed && (
        <div className="bg-[#1a3a5c] px-4 md:px-6 py-1 flex items-center justify-center gap-2 md:gap-3 relative z-10 text-center pr-8">
          <Info className="w-3 h-3 text-blue-200 shrink-0" />
          <span className="text-blue-100 text-[11px] leading-tight">
            We do not support piracy. We are not affiliated in any way with any game studio and/or Microsoft. By using this app you agree to our{' '}
            <Link to="/eula" className="underline hover:text-white">EULA</Link> and{' '}
            <Link to="/privacy" className="underline hover:text-white">Privacy Policy</Link>.{' '}
            Games are Powered by the <a href="https://github.com/rexglue/rexglue-sdk" target="_blank" rel="noopener noreferrer" className="underline hover:text-white" onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal('https://github.com/rexglue/rexglue-sdk'); } }}>rexglue-sdk</a>.
          </span>
          <button onClick={onDismissInfoBanner} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-200 hover:text-white transition-colors" aria-label="Dismiss">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </>
  );
}
