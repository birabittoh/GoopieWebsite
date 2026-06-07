import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { isOfflineMode } from '../utils/externalLink';

export interface NewsPost {
  id: string;
  title: string;
  body: string;
  /** First image (legacy). Mirrors `thumbnails[0]` for backwards compatibility. */
  thumbnail?: string;
  /** Ordered list of header/banner images. */
  thumbnails: string[];
  /** Optional list of tags shown on the news grid card. */
  tags?: string[];
  /** Optional id of a related game in the library (links to /library/<recompName>). */
  recompId?: string;
  /** Optional Patreon URL for the post. */
  patreonUrl?: string;
  authorUid: string;
  authorName: string;
  authorPicture?: string;
  createdAt: number; // ms epoch
  updatedAt?: number;
  /** Optional admin-set publication date used for ordering/display. Falls back to createdAt. */
  publishedAt?: number;
}

export interface NewsPostExtras {
  /** Legacy single thumbnail. If `thumbnails` is provided it takes precedence. */
  thumbnail?: string;
  thumbnails?: string[];
  tags?: string[];
  recompId?: string;
  patreonUrl?: string;
  /** Optional ms-epoch publication date override. `null` clears any existing override. */
  publishedAt?: number | null;
}

const HTTPS_URL = /^https:\/\/[^\s)]+$/i;
const MAX_THUMBNAILS = 8;

function tsToMillis(v: any): number {
  if (!v) return 0;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return new Date(v).getTime();
  return 0;
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = String(raw || '').trim();
    if (!t) continue;
    if (t.length > 32) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

function normalizeThumbnails(extras: NewsPostExtras): string[] {
  const raw: string[] = [];
  if (Array.isArray(extras.thumbnails)) raw.push(...extras.thumbnails.map(String));
  else if (extras.thumbnail) raw.push(String(extras.thumbnail));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const t = r.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_THUMBNAILS) break;
  }
  return out;
}

function validatePayload(payload: { thumbnails: string[]; patreonUrl: string }): string | null {
  for (const url of payload.thumbnails) {
    if (!HTTPS_URL.test(url)) return 'Each header image must be an https URL';
  }
  if (payload.patreonUrl) {
    if (!HTTPS_URL.test(payload.patreonUrl)) return 'Patreon link must be an https URL';
    if (!/^https:\/\/(www\.)?patreon\.com\//i.test(payload.patreonUrl)) {
      return 'Patreon link must point to patreon.com';
    }
  }
  return null;
}

function buildPayload(title: string, body: string, extras: NewsPostExtras) {
  const thumbnails = normalizeThumbnails(extras);
  return {
    title: title.trim(),
    body: body.trim(),
    thumbnail: thumbnails[0] || '',
    thumbnails,
    tags: normalizeTags(extras.tags),
    recompId: (extras.recompId || '').trim(),
    patreonUrl: (extras.patreonUrl || '').trim(),
  };
}

function publishedAtField(extras: NewsPostExtras): Timestamp | null | undefined {
  if (extras.publishedAt === undefined) return undefined; // do not write
  if (extras.publishedAt === null) return null; // explicit clear
  if (!Number.isFinite(extras.publishedAt)) return undefined;
  return Timestamp.fromMillis(extras.publishedAt as number);
}

export function useNews() {
  const { user } = useAuth();
  const [rawPosts, setRawPosts] = useState<NewsPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // No disk cache for news — explicit offline mode just means "no posts",
    // and skipping the subscription avoids spamming the console with
    // `firestore.googleapis.com` connection-error retries.
    if (isOfflineMode()) {
      setLoaded(true);
      return;
    }
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRawPosts(
          snap.docs.map((d) => {
            const data = d.data() as any;
            const thumbnails: string[] = Array.isArray(data.thumbnails)
              ? (data.thumbnails as any[]).map(String).filter(Boolean)
              : data.thumbnail
              ? [String(data.thumbnail)]
              : [];
            return {
              id: d.id,
              title: data.title || '',
              body: data.body || '',
              thumbnail: thumbnails[0] || '',
              thumbnails,
              tags: Array.isArray(data.tags) ? (data.tags as any[]).map(String) : [],
              recompId: data.recompId || '',
              patreonUrl: data.patreonUrl || '',
              authorUid: data.authorUid || '',
              authorName: data.authorName || 'Unknown',
              authorPicture: data.authorPicture || '',
              createdAt: tsToMillis(data.createdAt),
              updatedAt: tsToMillis(data.updatedAt),
              publishedAt: tsToMillis(data.publishedAt) || undefined,
            } as NewsPost;
          }),
        );
        setLoaded(true);
      },
      () => setLoaded(true),
    );
    return unsub;
  }, []);

  // Re-sort client-side using publishedAt (admin override) falling back to createdAt.
  const posts = useMemo(() => {
    return [...rawPosts].sort((a, b) => {
      const da = a.publishedAt ?? a.createdAt;
      const db_ = b.publishedAt ?? b.createdAt;
      return db_ - da;
    });
  }, [rawPosts]);

  const canPost = !!user && (user.role === 'admin' || user.role === 'developer');

  const canEdit = useCallback(
    (post: NewsPost) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return user.uid === post.authorUid && (user.role === 'developer' || user.role === 'admin');
    },
    [user],
  );

  // Only admins can override the publication date.
  const canSchedule = !!user && user.role === 'admin';

  const createPost = useCallback(
    async (title: string, body: string, extras: NewsPostExtras = {}): Promise<string> => {
      if (!canPost || !user) return 'Permission denied';
      const payload = buildPayload(title, body, extras);
      if (!payload.title) return 'Title is required';
      if (!payload.body) return 'Body is required';
      const err = validatePayload(payload);
      if (err) return err;
      try {
        const docPayload: any = {
          ...payload,
          authorUid: user.uid,
          authorName: user.username,
          authorPicture: user.picture || '',
          createdAt: serverTimestamp(),
        };
        if (canSchedule) {
          const pub = publishedAtField(extras);
          if (pub !== undefined) docPayload.publishedAt = pub;
        }
        await addDoc(collection(db, 'news'), docPayload);
        return 'ok';
      } catch (e: any) {
        return e?.message || 'Failed to create post';
      }
    },
    [canPost, canSchedule, user],
  );

  const updatePost = useCallback(
    async (id: string, title: string, body: string, extras: NewsPostExtras = {}): Promise<string> => {
      if (!user) return 'Permission denied';
      const post = posts.find((p) => p.id === id);
      if (!post) return 'Post not found';
      if (!canEdit(post)) return 'Permission denied';
      const payload = buildPayload(title, body, extras);
      if (!payload.title || !payload.body) return 'Title and body are required';
      const err = validatePayload(payload);
      if (err) return err;
      try {
        const update: any = {
          ...payload,
          updatedAt: serverTimestamp(),
        };
        if (canSchedule) {
          const pub = publishedAtField(extras);
          if (pub !== undefined) update.publishedAt = pub;
        }
        await updateDoc(doc(db, 'news', id), update);
        return 'ok';
      } catch (e: any) {
        return e?.message || 'Failed to update post';
      }
    },
    [user, posts, canEdit, canSchedule],
  );

  const deletePost = useCallback(
    async (id: string): Promise<string> => {
      if (!user) return 'Permission denied';
      const post = posts.find((p) => p.id === id);
      if (!post) return 'Post not found';
      if (!canEdit(post)) return 'Permission denied';
      try {
        await deleteDoc(doc(db, 'news', id));
        return 'ok';
      } catch (e: any) {
        return e?.message || 'Failed to delete post';
      }
    },
    [user, posts, canEdit],
  );

  return { posts, loaded, canPost, canEdit, canSchedule, createPost, updatePost, deletePost };
}
