import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { isOfflineMode } from '../utils/externalLink';

const MODS_COLLECTION = 'mods';

/**
 * Lifecycle status of a submitted mod within the catalog. `unapproved` mods
 * are only visible to their submitter and admins/developers of the game;
 * `approved` mods are publicly listed; `featured` mods are pinned to the top
 * of the public list. Real enforcement of who can transition between these
 * states lives in Firestore security rules — the functions below are the
 * happy path.
 */
export type CatalogModStatus = 'unapproved' | 'approved' | 'featured';

/**
 * A single mod catalog entry, as stored in the `mods` Firestore collection.
 * This mirrors what a developer/admin curates on the website — it's distinct
 * from the `ModInfo` shape in `useInstalledMods.ts`, which describes a mod
 * already unpacked on a player's disk (read from its manifest by the Rust
 * side). `recompName` ties a catalog entry to a specific game build.
 */
export interface CatalogMod {
  id: string;
  gameId: string;
  recompName: string;
  status: CatalogModStatus;

  // --- Where to fetch the mod's release asset from ---
  /** `"owner/repo"` on GitHub the mod's releases are published under. */
  githubRepo: string;
  /**
   * Release tag this entry is pinned to. Always a concrete tag, never
   * "latest" — the submit/edit/update-request forms may auto-fetch the
   * latest release when the tag input is left blank, but the resolved
   * tag is what gets stored, so every catalog entry (and its `checksum`)
   * stays pinned to one specific, reproducible release forever.
   */
  tag: string;
  /** Regex matched against release asset filenames to pick the right one (for repos with multiple assets per release). */
  assetRegex?: string;
  /** Exact asset filename to use, as an alternative to `assetRegex`. */
  assetName?: string;
  /** Resolved download URL for the selected asset, cached after the first lookup. */
  assetUrl?: string;
  /**
   * SHA-256 hex digest of `assetUrl`'s content, computed by the launcher (see
   * `computeModChecksum` in the bridge) at the moment an admin/developer
   * approves this mod, accepts a `pendingUpdate`, or edits its release asset
   * — never trust-on-first-use from the submitter, since a malicious
   * submitter could just recompute their own checksum too. The launcher
   * re-downloads and re-hashes the asset before installing and refuses to
   * install on a mismatch, so a release asset swapped out after approval
   * (e.g. a compromised GitHub repo) can't silently ship malware to players
   * who already trust this catalog entry. Required (both by every
   * write-path function below and by Firestore rules) on any write that
   * changes `assetUrl`, so a mod can never end up published/updated with a
   * stale or missing checksum. Only absent for `unapproved` mods that
   * haven't been reviewed yet.
   */
  checksum?: string;

  // --- Mod manifest metadata, mirrored here for display without re-fetching the asset ---
  modId: string;
  name: string;
  author: string;
  description: string;
  version: string;
  /** Platform target(s) this mod ships a binary for, e.g. `["windows-x64"]`; unset/empty for asset-only mods. */
  platform?: string[];
  /**
   * Other mods this mod depends on. Each entry is either a bare `modId`
   * (any installed/enabled version satisfies it) or `"modId >= 1.2.0"`
   * (a minimum-version pin) — the same shape the launcher's `mod.toml`
   * `requires` field uses (see `mods.rs`'s `format_requirement`), so a
   * dependency declared here is validated identically to one declared in a
   * mod's own manifest.
   */
  requires?: string[];
  iconUrl?: string;
  /** Screenshot image URLs shown on the mod's detail panel. */
  screenshots?: string[];
  /** YouTube video URLs (or bare video IDs) shown alongside screenshots. */
  videoUrls?: string[];
  /**
   * Minimum host application (game) version this mod requires, e.g.
   * `"1.2.0"` (a leading `v` is also accepted) — mirrors the launcher's
   * `mod.toml` `game_version` field (see `mods.rs`'s
   * `parse_game_version_constraint`). Unset if the submitter didn't declare one.
   */
  gameVersion?: string;

  // --- Submission / moderation trail ---
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;

  /**
   * A submitter-proposed new release for this mod, awaiting admin/developer
   * review — see [`requestModUpdate`]. Approving a mod locks its
   * `githubRepo`/`modId` (see `EditModModal`'s copy), so this is how a
   * submitter pushes a new version of their own mod without an admin having
   * to do it for them or the mod losing its approved/featured
   * status via reject-and-resubmit. Only one request lives at a time — a
   * new `requestModUpdate` call overwrites it, and accepting/rejecting
   * clears it back to `null`/undefined.
   */
  pendingUpdate?: PendingModUpdate | null;
}

/** See [`CatalogMod.pendingUpdate`]. */
export interface PendingModUpdate {
  /** Specific release tag this request resolved to — see [`CatalogMod.tag`]. */
  tag: string;
  assetName: string;
  assetUrl: string;
  version: string;
  gameVersion?: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
}

/**
 * Subscribes in real time to the catalog of mods submitted for `gameId`.
 * Returns every status (unapproved/approved/featured) — callers
 * are expected to filter by `status` and by `canEditGame`/`submittedBy` to
 * decide what a given viewer should actually see, since Firestore security
 * rules (not this hook) are the real gate on who can *read* unapproved mods.
 */
export function useModCatalog(gameId: string): { mods: CatalogMod[]; loading: boolean } {
  const [mods, setMods] = useState<CatalogMod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId || isOfflineMode()) {
      setMods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, MODS_COLLECTION), where('gameId', '==', gameId));
    const unsub = onSnapshot(q, (snapshot) => {
      setMods(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CatalogMod)));
      setLoading(false);
    }, () => {
      // Firestore unreachable — leave whatever we last had, but stop showing a spinner forever.
      setLoading(false);
    });
    return unsub;
  }, [gameId]);

  return { mods, loading };
}

/** Fields a submitter provides; the rest (status, submittedBy/At) are stamped by `submitMod`. */
export interface SubmitModInput {
  gameId: string;
  recompName: string;
  githubRepo: string;
  tag: string;
  assetRegex?: string;
  assetName?: string;
  modId: string;
  name: string;
  author: string;
  description: string;
  version: string;
  platform?: string[];
  requires?: string[];
  iconUrl?: string;
  screenshots?: string[];
  videoUrls?: string[];
  gameVersion?: string;
  submittedBy: string;
  submittedByName: string;
}

/** Metadata fields editable after submission, via `updateModMetadata`. Deliberately excludes `gameId`/`recompName`/`modId` (identity, never edited) and the submission trail (`submittedBy`/`submittedByName`/`submittedAt`). */
export type ModMetadataPatch = Partial<
  Pick<
    CatalogMod,
    'githubRepo' | 'tag' | 'assetRegex' | 'assetName' | 'assetUrl' | 'checksum' |
    'name' | 'author' | 'description' | 'version' | 'platform' | 'requires' | 'iconUrl' | 'screenshots' | 'videoUrls' | 'gameVersion'
  >
>;

/**
 * Deterministic doc ID for a game's mod, derived from `gameId` + `modId`.
 * `modId` becomes the mod's on-disk folder name under `<recompName>/mods/`
 * (see `mods.rs`), so it must be unique per game — keying the Firestore doc
 * this way turns a duplicate submission into a collision with the existing
 * doc (an `update`, gated to privileged users by security rules) instead of
 * silently creating a second catalog entry for the same folder name.
 */
function modDocId(gameId: string, modId: string): string {
  return `${gameId}__${modId}`;
}

/**
 * Creates a new catalog entry in the `unapproved` state, pending review.
 * Throws if a mod with the same `modId` already exists for this game (see
 * [`modDocId`]) — callers should catch this and surface a "name taken"
 * message rather than silently overwriting someone else's submission.
 */
export async function submitMod(input: SubmitModInput): Promise<void> {
  const cleaned = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );
  const id = modDocId(input.gameId, input.modId);
  const ref = doc(db, MODS_COLLECTION, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error(`A mod with id "${input.modId}" already exists for this game.`);
  }
  await setDoc(ref, {
    ...cleaned,
    status: 'unapproved' as CatalogModStatus,
    submittedAt: new Date().toISOString(),
  });
}

/**
 * Updates a mod's editable metadata (name/author/description/version/
 * requires/platform/icon/screenshots/videos, and — if re-resolved — its
 * source repo/tag/regex/asset). Mirrors editing a game's details: gated to
 * admins/assigned developers by Firestore rules, not by this function.
 *
 * If `patch.assetUrl` is set (the caller re-resolved a new release), a
 * non-empty `patch.checksum` computed from that same asset is required —
 * Firestore rules enforce this too, but failing fast here gives the caller a
 * clear error instead of a rejected write. See `CatalogMod.checksum`.
 */
export async function updateModMetadata(id: string, patch: ModMetadataPatch): Promise<void> {
  if (patch.assetUrl && !patch.checksum) {
    throw new Error('Cannot update a mod\'s release asset without a checksum.');
  }
  const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, MODS_COLLECTION, id), cleaned);
}

/** Fields a submitter resolves and proposes as their mod's next release. */
export interface ModUpdateRequestInput {
  tag: string;
  assetName: string;
  assetUrl: string;
  version: string;
  gameVersion?: string;
}

/**
 * Proposes a new release for a mod the caller submitted, pending admin/dev
 * review. Overwrites any existing pending request for the same mod (there's
 * only ever one at a time). Firestore rules restrict this write to the
 * mod's own `submittedBy`, and scope it to the `pendingUpdate` field only —
 * a submitter can't use this to change anything else about their listing.
 */
export async function requestModUpdate(
  id: string,
  submitterUid: string,
  submitterName: string,
  input: ModUpdateRequestInput,
): Promise<void> {
  const cleaned = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, MODS_COLLECTION, id), {
    pendingUpdate: {
      ...cleaned,
      requestedBy: submitterUid,
      requestedByName: submitterName,
      requestedAt: new Date().toISOString(),
    },
  });
}

/** Withdraws the caller's own pending update request without applying it. */
export async function cancelModUpdate(id: string): Promise<void> {
  await updateDoc(doc(db, MODS_COLLECTION, id), { pendingUpdate: null });
}

/**
 * Applies `mod`'s pending update request onto its published release/version
 * fields and clears the request. Admin/developer only (enforced by
 * Firestore rules, which gate any write outside `pendingUpdate` to them).
 * `checksum`, computed from `p.assetUrl` via the launcher's
 * `computeModChecksum` bridge call, replaces the mod's previous checksum —
 * an accepted update ships a new asset, so the old checksum no longer
 * applies, and one is required since this always changes `assetUrl`. See
 * `CatalogMod.checksum`.
 */
export async function acceptModUpdate(mod: CatalogMod, checksum: string): Promise<void> {
  const p = mod.pendingUpdate;
  if (!p) return;
  if (!checksum) {
    throw new Error('Cannot accept a mod update without a checksum for the new release asset.');
  }
  const fields = { tag: p.tag, assetName: p.assetName, assetUrl: p.assetUrl, version: p.version, gameVersion: p.gameVersion, checksum };
  const cleaned = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, MODS_COLLECTION, mod.id), {
    ...cleaned,
    pendingUpdate: null,
  });
}

/** Dismisses a mod's pending update request without applying it. Admin/developer only. */
export async function rejectModUpdate(id: string): Promise<void> {
  await updateDoc(doc(db, MODS_COLLECTION, id), { pendingUpdate: null });
}

/**
 * Approves an `unapproved` mod, making it publicly visible. Stamps the
 * reviewer and `checksum` (computed from the mod's `assetUrl` via the
 * launcher's `computeModChecksum` bridge call — see `CatalogMod.checksum`),
 * which is required so the launcher can always detect the release asset
 * being swapped out later.
 */
export async function approveMod(id: string, reviewedBy: string, checksum: string): Promise<void> {
  if (!checksum) {
    throw new Error('Cannot approve a mod without a checksum for its release asset.');
  }
  await updateDoc(doc(db, MODS_COLLECTION, id), {
    status: 'approved' as CatalogModStatus,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    checksum,
  });
}

/**
 * Rejects an `unapproved` mod submission by deleting it outright — there's
 * no "rejected" status to keep around. Only sensible from `unapproved`, but
 * that's not enforced here; real enforcement belongs in Firestore rules.
 */
export async function rejectMod(id: string): Promise<void> {
  await deleteDoc(doc(db, MODS_COLLECTION, id));
}

/** Pins an approved mod to the top of the public list. */
export async function featureMod(id: string): Promise<void> {
  await updateDoc(doc(db, MODS_COLLECTION, id), { status: 'featured' as CatalogModStatus });
}

/** Un-pins a featured mod back to plain `approved`. */
export async function unfeatureMod(id: string): Promise<void> {
  await updateDoc(doc(db, MODS_COLLECTION, id), { status: 'approved' as CatalogModStatus });
}

