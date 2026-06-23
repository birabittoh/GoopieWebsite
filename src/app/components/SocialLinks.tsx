import { Globe } from 'lucide-react';
import type { Game } from '../types/game';

type SocialLinksType = NonNullable<Game['socialLinks']>;

export function SupportLinks({
  socialLinks,
  isInCEF,
  openExternal,
  compact,
}: {
  socialLinks: SocialLinksType;
  isInCEF: boolean;
  openExternal: (url: string) => void;
  compact?: boolean;
}) {
  if (!socialLinks.patreon && !socialLinks.kofi) return null;
  const h = compact ? 'h-8' : 'h-9';
  const px = compact ? 'px-3' : 'px-4';
  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = compact ? 'text-xs' : 'text-sm';
  return (
    <div className="flex flex-wrap gap-2">
      {socialLinks.patreon && (
        <a
          href={socialLinks.patreon}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-${compact ? '1.5' : '2'} ${px} ${h} rounded-full bg-[#FF424D] hover:bg-[#e03840] text-white ${textSize} font-semibold shadow-md transition-colors`}
          title="Support on Patreon"
          onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(socialLinks.patreon!); } }}
        >
          <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor"><path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524zM.003 23.476h4.22V.524H.003v22.952z"/></svg>
          Patreon
        </a>
      )}
      {socialLinks.kofi && (
        <a
          href={socialLinks.kofi}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-${compact ? '1.5' : '2'} ${px} ${h} rounded-full bg-[#29ABE0] hover:bg-[#2299cc] text-white ${textSize} font-semibold shadow-md transition-colors`}
          title="Support on Ko-fi"
          onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(socialLinks.kofi!); } }}
        >
          <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor"><path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/></svg>
          Ko-fi
        </a>
      )}
    </div>
  );
}

export function SocialLinkIcons({
  socialLinks,
  isInCEF,
  openExternal,
  compact,
}: {
  socialLinks: SocialLinksType;
  isInCEF: boolean;
  openExternal: (url: string) => void;
  compact?: boolean;
}) {
  const p = compact ? 'p-2' : 'p-3';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const cefClick = (url: string) => (e: React.MouseEvent) => {
    if (isInCEF) { e.preventDefault(); openExternal(url); }
  };
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'justify-end'}`}>
      {socialLinks.discord && (
        <a href={socialLinks.discord} target="_blank" rel="noopener noreferrer" className={`${p} bg-[#5865F2] hover:bg-[#4752c4] rounded-lg transition-colors`} title="Discord" onClick={cefClick(socialLinks.discord)}>
          <svg className={`${iconSize} text-white`} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
        </a>
      )}
      {socialLinks.twitter && (
        <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className={`${p} bg-[#1DA1F2] hover:bg-[#1a8cd8] rounded-lg transition-colors`} title="Twitter" onClick={cefClick(socialLinks.twitter)}>
          <svg className={`${iconSize} text-white`} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
      )}
      {socialLinks.bluesky && (
        <a href={socialLinks.bluesky} target="_blank" rel="noopener noreferrer" className={`${p} bg-[#0085ff] hover:bg-[#0070dd] rounded-lg transition-colors`} title="Bluesky" onClick={cefClick(socialLinks.bluesky)}>
          <svg className={`${iconSize} text-white`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.6 3.476 6.278 3.087-4.787.91-6.004 3.407-3.318 5.921C6.345 21.828 9.702 21.25 12 18.904c2.298 2.346 5.655 2.924 8.416.35 2.686-2.513 1.469-5.01-3.318-5.92 2.677.389 5.493-.46 6.278-3.088C23.622 9.419 24 4.459 24 3.768c0-.688-.139-1.86-.902-2.203-.659-.3-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>
        </a>
      )}
      {socialLinks.youtube && (
        <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className={`${p} bg-[#FF0000] hover:bg-[#cc0000] rounded-lg transition-colors`} title="YouTube" onClick={cefClick(socialLinks.youtube)}>
          <svg className={`${iconSize} text-white`} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        </a>
      )}
      {socialLinks.website && (
        <a href={socialLinks.website} target="_blank" rel="noopener noreferrer" className={`${p} rounded-lg transition-colors`} style={{ backgroundColor: 'var(--theme-item-selected)' }} title="Website" onClick={cefClick(socialLinks.website)}>
          <Globe className={`${iconSize} text-white`} />
        </a>
      )}
      {socialLinks.github && (
        <a href={socialLinks.github} target="_blank" rel="noopener noreferrer" className={`${p} bg-[#333] hover:bg-[#555] rounded-lg transition-colors`} title="GitHub" onClick={cefClick(socialLinks.github)}>
          <svg className={`${iconSize} text-white`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
        </a>
      )}
      {socialLinks.reddit && (
        <a href={socialLinks.reddit} target="_blank" rel="noopener noreferrer" className={`${p} bg-[#FF4500] hover:bg-[#e03d00] rounded-lg transition-colors`} title="Reddit" onClick={cefClick(socialLinks.reddit)}>
          <svg className={`${iconSize} text-white`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.053 1.597a3.45 3.45 0 0 1 .042.52c0 2.694-3.13 4.884-7.005 4.884-3.875 0-7.005-2.19-7.005-4.884a3.6 3.6 0 0 1 .043-.524A1.745 1.745 0 0 1 4.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 0-.463.327.327 0 0 0-.462 0c-.545.533-1.684.73-2.512.73-.828 0-1.953-.197-2.498-.73a.327.327 0 0 0-.232-.095z"/></svg>
        </a>
      )}
    </div>
  );
}
