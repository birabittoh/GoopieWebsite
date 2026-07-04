import { Pencil, EyeOff, Eye, Bug, X, Star } from 'lucide-react';
import type { Game } from '../types/game';
import { StarRating } from './StarRating';
import { GameActionButtons, type GameActionButtonsProps } from './GameActionButtons';
import { SupportLinks, SocialLinkIcons } from './SocialLinks';
import { isTauriLinuxLauncher } from '../utils/externalLink';

interface CrossfadeSlot {
  src: string;
}

interface GameDetailHeaderProps {
  game: Game;
  slotA: CrossfadeSlot;
  slotB: CrossfadeSlot;
  activeSlot: 'A' | 'B';
  isInCEF: boolean;
  openExternal: (url: string) => void;
  canEdit: boolean;
  canPreview: boolean;
  onEdit: () => void;
  onPreview: () => void;
  averageRating: number;
  totalRatings: number;
  userRating: number | undefined;
  onRate: ((stars: number) => void) | undefined;
  isLoggedIn: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  launchError: string | null;
  onDismissLaunchError: () => void;
  actionButtonsProps: GameActionButtonsProps | null;
}

export function GameDetailHeader({
  game,
  slotA,
  slotB,
  activeSlot,
  isInCEF,
  openExternal,
  canEdit,
  canPreview,
  onEdit,
  onPreview,
  averageRating,
  totalRatings,
  userRating,
  onRate,
  isLoggedIn,
  isFavorite,
  onToggleFavorite,
  launchError,
  onDismissLaunchError,
  actionButtonsProps,
}: GameDetailHeaderProps) {
  const bugReportUrl = (() => {
    const match = game.githubReleaseUrl?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/);
    if (!match) return null;
    return `https://github.com/${match[1]}/issues`;
  })();

  return (
    <>
      {/* Header Image */}
      <div className="relative h-[200px] md:h-[500px] overflow-hidden z-10 ">
        {([{ id: 'A', slot: slotA }, { id: 'B', slot: slotB }] as const).map(({ id, slot }) => (
          slot.src ? (
          <img
            key={id}
            src={slot.src}
            alt={game.title}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: activeSlot === id ? (('var(--theme-header-alpha)' as unknown) as number) : 0,
              transition: isTauriLinuxLauncher() ? 'none' : 'opacity 1s ease-in-out',
            }}
          />
          ) : null
        ))}
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--theme-header-color)', mixBlendMode: 'multiply' }} />
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--theme-header-overlay)' }} />
        {game.titleImage && (
          <img
            src={game.titleImage}
            alt={game.title}
            className="absolute top-4 left-4 object-contain drop-shadow-2xl hidden md:block"
            style={{
              maxHeight: `${170 * (game.titleSizeMultiplier || 1)}px`,
              maxWidth: `${0.45 * 100 * (game.titleSizeMultiplier || 1)}%`,
            }}
          />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, var(--theme-page-bg), color-mix(in srgb, var(--theme-page-bg) 50%, transparent), transparent)` }}></div>

        {/* Discord widget */}
        {game.discordGuildId && !isInCEF && (
          <div className="absolute top-3 right-3 z-20 hidden md:block rounded-xl overflow-hidden shadow-2xl" style={{ width: 300, height: 420 }}>
            <iframe
              src={`https://discord.com/widget?id=${game.discordGuildId}&theme=dark`}
              width="300"
              height="420"
              allowTransparency={true}
              frameBorder={0}
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              title="Discord"
              className="w-full h-full block"
            />
          </div>
        )}

        {/* Desktop: overlay content on the header image */}
        <div className="absolute bottom-0 left-0 right-0 p-4 hidden md:block">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {!game.hideTitleText && (
            <h1
              className="text-5xl font-bold"
              style={{
                color: 'rgb(255, 255, 255)',
                textShadow: 'rgba(0, 0, 0, 0.85) 3px 3px 0px, rgba(0, 0, 0, 0.7) 6px 6px 3px',
              }}
            >
              {game.title}
            </h1>
            )}
            {game.isPublic === false && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500 text-white flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> Not Public
              </span>
            )}
            {game.pendingApproval && !game.isPublic && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500 text-black flex items-center gap-1">
                Pending Approval
              </span>
            )}
            {canEdit ? (
              <button
                onClick={onEdit}
                className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500 text-black flex items-center gap-1 hover:bg-yellow-400 transition-colors"
              >
                <Pencil className="w-3 h-3" /> Edit Game
              </button>
            ) : canPreview ? (
              <button
                onClick={onPreview}
                className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white flex items-center gap-1 hover:bg-blue-400 transition-colors"
              >
                <Eye className="w-3 h-3" /> Preview Editor
              </button>
            ) : bugReportUrl ? (
              <a
                href={bugReportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white flex items-center gap-1 hover:bg-red-400 transition-colors"
                onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(bugReportUrl); } }}
              >
                <Bug className="w-3 h-3" /> Bug report
              </a>
            ) : null}
          </div>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {game.Tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded text-sm"
                  style={{ backgroundColor: 'var(--theme-tag-bg)', color: 'var(--theme-tag-fg)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <StarRating
              averageRating={averageRating}
              totalRatings={totalRatings}
              userRating={userRating}
              onRate={onRate}
              readonly={!isLoggedIn}
              guestPrompt={!isLoggedIn}
            />
            <button
              onClick={onToggleFavorite}
              className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'rgba(0,0,0,0.55)',
                color: isFavorite ? '#facc15' : 'rgba(255,255,255,0.9)',
              }}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
            >
              <Star className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
          {launchError && (
            <div className="flex items-start justify-between gap-3 p-3 mb-3 rounded-lg shadow bg-red-950/80 border border-red-500/40 text-sm text-red-200">
              <span>{launchError}</span>
              <button
                type="button"
                onClick={onDismissLaunchError}
                className="shrink-0 opacity-70 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex flex-row items-end justify-between gap-4">
          <div>
          {actionButtonsProps && <GameActionButtons {...actionButtonsProps} />}
          </div>

          {/* Support + Social Links */}
          <div className="flex flex-col gap-2 items-end">
            {game.socialLinks && (
              <SupportLinks socialLinks={game.socialLinks} isInCEF={isInCEF} openExternal={openExternal} />
            )}
            {game.socialLinks && (
              <SocialLinkIcons socialLinks={game.socialLinks} isInCEF={isInCEF} openExternal={openExternal} />
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Mobile: game info below the header image */}
      <div className="md:hidden p-4 relative z-10 space-y-4" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <h1
            className="text-2xl font-bold"
            style={{
              color: 'rgb(255, 255, 255)',
              textShadow: 'rgba(0, 0, 0, 0.85) 3px 3px 0px, rgba(0, 0, 0, 0.7) 6px 6px 3px',
            }}
          >
            {game.title}
          </h1>
          {game.isPublic === false && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white flex items-center gap-1">
              <EyeOff className="w-3 h-3" /> Not Public
            </span>
          )}
          {game.pendingApproval && !game.isPublic && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-black flex items-center gap-1">
              Pending Approval
            </span>
          )}
          {canEdit ? (
            <button
              onClick={onEdit}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-black flex items-center gap-1 hover:bg-yellow-400 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          ) : canPreview ? (
            <button
              onClick={onPreview}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white flex items-center gap-1 hover:bg-blue-400 transition-colors"
            >
              <Eye className="w-3 h-3" /> Preview
            </button>
          ) : bugReportUrl ? (
            <a
              href={bugReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white flex items-center gap-1 hover:bg-red-400 transition-colors"
              onClick={(e) => { if (isInCEF) { e.preventDefault(); openExternal(bugReportUrl); } }}
            >
              <Bug className="w-3 h-3" /> Bug report
            </a>
          ) : null}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-wrap gap-1.5">
            {game.Tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: 'var(--theme-tag-bg)', color: 'var(--theme-tag-fg)' }}
              >
                {tag}
              </span>
            ))}
          </div>
          <StarRating
            averageRating={averageRating}
            totalRatings={totalRatings}
            userRating={userRating}
            onRate={onRate}
            readonly={!isLoggedIn}
            guestPrompt={!isLoggedIn}
          />
          {game.socialLinks && (
            <SupportLinks socialLinks={game.socialLinks} isInCEF={isInCEF} openExternal={openExternal} compact />
          )}
        </div>
        {actionButtonsProps && <GameActionButtons {...actionButtonsProps} compact />}
        {game.socialLinks && (
          <SocialLinkIcons socialLinks={game.socialLinks} isInCEF={isInCEF} openExternal={openExternal} compact />
        )}
      </div>
    </>
  );
}
