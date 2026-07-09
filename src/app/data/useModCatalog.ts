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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const MODS_COLLECTION = 'mods';

/**
 * Lifecycle status of a submitted mod within the catalog. `unapproved` mods
 * are only visible to their submitter and admins/developers of the game;
 * `approved` mods are publicly listed; `featured` mods are pinned to the top
 * of the public list; `required` mods are auto-installed/force-enabled for
 * everyone playing the game (and are ordered relative to each other via
 * `order`). Real enforcement of who can transition between these states
 * lives in Firestore security rules — the functions below are the happy path.
 */
export type CatalogModStatus = 'unapproved' | 'approved' | 'featured' | 'required';

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
  /** Sort priority among `required` mods only (lower loads first); unused for other statuses. */
  order?: number;

  // --- Where to fetch the mod's release asset from ---
  /** `"owner/repo"` on GitHub the mod's releases are published under. */
  githubRepo: string;
  /** Specific release tag to pin to, or unset to always use the latest release. */
  tag?: string;
  /** Regex matched against release asset filenames to pick the right one (for repos with multiple assets per release). */
  assetRegex?: string;
  /** Exact asset filename to use, as an alternative to `assetRegex`. */
  assetName?: string;
  /** Resolved download URL for the selected asset, cached after the first lookup. */
  assetUrl?: string;

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

  // --- Submission / moderation trail ---
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

/**
 * Subscribes in real time to the catalog of mods submitted for `gameId`.
 * Returns every status (unapproved/approved/featured/required) — callers
 * are expected to filter by `status` and by `canEditGame`/`submittedBy` to
 * decide what a given viewer should actually see, since Firestore security
 * rules (not this hook) are the real gate on who can *read* unapproved mods.
 */
export function useModCatalog(gameId: string): { mods: CatalogMod[]; loading: boolean } {
  const [mods, setMods] = useState<CatalogMod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) {
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
  tag?: string;
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
  submittedBy: string;
  submittedByName: string;
}

/** Metadata fields editable after submission, via `updateModMetadata`. Deliberately excludes `gameId`/`recompName`/`modId` (identity, never edited) and the submission trail (`submittedBy`/`submittedByName`/`submittedAt`). */
export type ModMetadataPatch = Partial<
  Pick<
    CatalogMod,
    'githubRepo' | 'tag' | 'assetRegex' | 'assetName' | 'assetUrl' |
    'name' | 'author' | 'description' | 'version' | 'platform' | 'requires' | 'iconUrl' | 'screenshots' | 'videoUrls'
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
 */
export async function updateModMetadata(id: string, patch: ModMetadataPatch): Promise<void> {
  const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, MODS_COLLECTION, id), cleaned);
}

/** Approves an `unapproved` mod, making it publicly visible. Stamps the reviewer. */
export async function approveMod(id: string, reviewedBy: string): Promise<void> {
  await updateDoc(doc(db, MODS_COLLECTION, id), {
    status: 'approved' as CatalogModStatus,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
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

/** Marks an approved mod as required — auto-installed/force-enabled for every player of the game. */
export async function requireMod(id: string): Promise<void> {
  await updateDoc(doc(db, MODS_COLLECTION, id), { status: 'required' as CatalogModStatus });
}

/** Demotes a required mod back to plain `approved`. */
export async function unrequireMod(id: string): Promise<void> {
  await updateDoc(doc(db, MODS_COLLECTION, id), { status: 'approved' as CatalogModStatus });
}

/**
 * Persists a new load-priority order for the given `required` mod ids (index
 * in the array becomes its `order` field). Uses a single batched write so
 * the reorder applies atomically instead of racing individual `updateDoc`
 * calls against concurrent listeners.
 */
export async function reorderRequiredMods(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id, index) => {
    batch.update(doc(db, MODS_COLLECTION, id), { order: index });
  });
  await batch.commit();
}
