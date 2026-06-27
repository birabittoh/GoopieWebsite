export type Platform = 'Windows' | 'Linux' | 'Mac';

export interface Game {
  id: string;
  title: string;
  recompName: string;
  /** SHA-256 hash of the original XEX the recomp targets. */
  xexSha256?: string;
  /** Region/version of the XEX (e.g. "World", "USA", "PAL"). */
  xexVersion?: string;
  og_developer: string;
  recompiled_developers: string[];
  Tags: string[];
  platforms?: Platform[];
  status: 'Featured' | 'Enhanced' | 'Playable' | 'Gameplay' | 'Loads' | 'Unplayable' | 'Unknown';
  coverImage: string;
  headerImage: string | string[];
  titleImage?: string;
  description: string;
  isPublic?: boolean;
  pendingApproval?: boolean;
  accentColor?: string;
  socialLinks?: {
    twitter?: string;
    discord?: string;
    website?: string;
    patreon?: string;
    kofi?: string;
    bluesky?: string;
    youtube?: string;
    github?: string;
    reddit?: string;
  };
  /**
   * Discord server/guild ID for the embedded widget.
   * Required to show the live Discord widget on the game page.
   * Find it by enabling Community in your Discord server settings.
   */
  discordGuildId?: string;
  /**
   * Array of media links (YouTube URLs or image URLs)
   */
  mediaLinks?: string[];

  /**
   * Multiplier for the title image size (1 = 100%, 1.5 = 150%, etc.)
   */
  titleSizeMultiplier?: number;

  /**
   * When true, the title text is hidden on the Library page (useful when
   * the game has a high-quality title image that already shows the name).
   */
  hideTitleText?: boolean;

  /**
   * Optional YouTube URL(s) to play as looping background audio when the game is selected.
   * If an array, one is randomly picked each time the game is clicked.
   */
  backgroundAudio?: string | string[];

  /**
   * GitHub release download URL for the game executable
   */
  githubReleaseUrl?: string;

  /**
   * GitHub API URL for checking updates, e.g. https://api.github.com/repos/owner/repo/releases/latest
   */
  githubApiUrl?: string;

  /**
   * GitHub repository in `owner/repo` form. When provided, it is used to
   * enumerate all releases (stable + nightly) and the per-release asset list,
   * so users can pick a specific version + build.
   *
   * If omitted, the repo is inferred from `githubReleaseUrl` / `githubApiUrl`.
   */
  githubRepo?: string;

  /**
   * Preferred default asset filename suffix for this game's GitHub releases,
   * relative to the recompName. Defaults to `"-windows-x64-release.exe"` then
   * `"-windows-x64.exe"` when not set.
   */
  preferredAssetSuffix?: string;

  /**
   * Optional external launcher URL for games that use their own proprietary launcher.
   * When set, a link button is shown on the game page so users can get the game externally.
   */
  externalLauncherUrl?: string;

  /**
   * When true, launcher will append `--game_data_root="<game>/assets"` on launch.
   * Existing games should default to false unless explicitly enabled.
   */
  setGameDataRootToAssets?: boolean;

  /**
   * When true, the save manager is disabled for this game.
   */
  disableSaveManager?: boolean;

  /**
   * Whether a title update is required, optional, or hidden for this game.
   * Missing = 'hidden' for backwards compatibility.
   */
  updateStatus?: 'required' | 'optional' | 'hidden';

  /**
   * SHA-256 hash of the raw title update STFS file. When non-empty, the
   * launcher verifies the dropped/browsed file against this before installing.
   */
  updateChecksum?: string;

  /**
   * Known DLC display names for this game. Used to match installed DLC
   * packages by their STFS display name header.
   */
  dlcNames?: string[];

  /**
   * When true, the game's base data comes from an XBLA (STFS) package
   * instead of a disc ISO. Affects the file-picker filter (no filter
   * for XBLA vs .iso-only) and forces `--license_mask=1` at launch.
   */
  isXBLA?: boolean;

  /**
   * When true, launches with `--gpu_plugin xenos` to use the Xenia renderer.
   */
  useXenosRenderer?: boolean;

  /**
   * Configurable cvars exposed to the player as a settings panel on the
   * game page. Their values are appended as `-tag value` pairs to the
   * launch command passed to the launcher.
   */
  cvars?: CVar[];
}

export type CVarType = 'Int' | 'Float' | 'Bool';

export interface CVar {
  /** Stable id (uuid) so list edits don't collide on tag rename. */
  id: string;
  /** Human-readable label shown in the launcher settings panel. */
  displayName: string;
  /** Lowercase identifier used on the command line (e.g. `numberofcoins`). */
  tag: string;
  /** Variable type. */
  type: CVarType;
  /** Default value used when the player hasn't customized it. */
  defaultValue: number | boolean;
  /** Optional description shown to the player. */
  description?: string;
}

export type ViewMode = 'grid' | 'list';
export type SortBy = 'name' | 'status';
