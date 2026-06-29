import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

export type Role = 'admin' | 'developer' | 'user';

interface User {
  uid: string;
  username: string;
  email: string;
  picture?: string;
  role: Role;
  assignedGames: string[];
  createdAt: string;
}

export interface DeveloperRequest {
  id: string;
  uid: string;
  username: string;
  email: string;
  picture?: string;
  message: string;
  createdAt: string;
}

export interface DeletionRequest {
  id: string;
  uid: string;
  username: string;
  email: string;
  picture?: string;
  reason: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<string>;
  logout: () => Promise<void>;
  canEditGame: (gameId: string) => boolean;
  canSetRoles: () => boolean;
  setUserRole: (uid: string, role: Role) => Promise<string>;
  assignGame: (uid: string, gameId: string) => Promise<string>;
  unassignGame: (uid: string, gameId: string) => Promise<string>;
  getAllUsers: () => Promise<{ uid: string; username: string; email: string; picture?: string; role: Role; assignedGames: string[] }[]>;
  submitDeveloperRequest: (message: string) => Promise<string>;
  getDeveloperRequests: () => Promise<DeveloperRequest[]>;
  approveDeveloperRequest: (requestId: string, uid: string) => Promise<string>;
  denyDeveloperRequest: (requestId: string) => Promise<string>;
  deleteUser: (uid: string) => Promise<string>;
  submitDeletionRequest: (reason: string) => Promise<string>;
  getDeletionRequests: () => Promise<DeletionRequest[]>;
  approveDeletionRequest: (requestId: string, uid: string) => Promise<string>;
  denyDeletionRequest: (requestId: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Your Google email — the first account to ever sign in also gets admin
const DEFAULT_ADMIN_EMAILS = ['cochack1182@gmail.com'];

async function getOrCreateUserDoc(firebaseUser: FirebaseUser): Promise<User> {
  const userRef = doc(db, 'users', firebaseUser.uid);

  try {
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      const isDefaultAdmin = DEFAULT_ADMIN_EMAILS.includes(firebaseUser.email?.toLowerCase() || '');
      const role = isDefaultAdmin ? 'admin' : (data.role || 'user');

      // Update display name / photo if they changed on the Google side
      try {
        if (data.username !== firebaseUser.displayName || data.picture !== firebaseUser.photoURL) {
          await updateDoc(userRef, {
            username: firebaseUser.displayName || data.username,
            picture: firebaseUser.photoURL || data.picture,
          });
        }
      } catch {
        // Non-critical — ignore if update fails
      }

      return {
        uid: firebaseUser.uid,
        username: firebaseUser.displayName || data.username,
        email: data.email,
        picture: firebaseUser.photoURL || data.picture,
        role,
        assignedGames: data.assignedGames || [],
        createdAt: data.createdAt,
      };
    }
  } catch {
    // Doc doesn't exist or can't be read — proceed to create
  }

  // New user — hardcoded admin emails get admin, everyone else gets user
  const isDefaultAdmin = DEFAULT_ADMIN_EMAILS.includes(firebaseUser.email?.toLowerCase() || '');
  const role: Role = isDefaultAdmin ? 'admin' : 'user';

  const newUser = {
    username: firebaseUser.displayName || 'Unknown',
    email: firebaseUser.email || '',
    picture: firebaseUser.photoURL || '',
    role,
    assignedGames: [],
    createdAt: new Date().toISOString(),
  };

  // Use set with merge to handle race conditions where both
  // onAuthStateChanged and loginWithGoogle create the doc simultaneously
  await setDoc(userRef, newUser, { merge: true });

  return { uid: firebaseUser.uid, ...newUser };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const appUser = await getOrCreateUserDoc(firebaseUser);
          setUser(appUser);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithGoogle = async (): Promise<string> => {
    // Launcher path: window.GoogleSignIn is injected by the GoopieLauncher bridge shim.
    if (typeof (window as any).GoogleSignIn === 'function') {
      try {
        (window as any).GoogleSignIn();

        const result = await new Promise<{ status: string; accessToken?: string; message?: string }>(
          (resolve) => {
            const interval = setInterval(() => {
              const r = (window as any).getGoogleSignInResult?.();
              if (r && r.status !== 'pending' && r.status !== 'idle') {
                clearInterval(interval);
                clearTimeout(timeout);
                resolve(r);
              }
            }, 500);
            const timeout = setTimeout(() => {
              clearInterval(interval);
              resolve({ status: 'error', message: 'Sign-in timed out' });
            }, 310_000);
          },
        );

        if (result.status !== 'ok' || !result.accessToken) {
          return result.message || 'Google sign-in failed';
        }

        const credential = GoogleAuthProvider.credential(null, result.accessToken);
        const userCredential = await signInWithCredential(auth, credential);
        const appUser = await getOrCreateUserDoc(userCredential.user);
        setUser(appUser);
        return 'ok';
      } catch (err: any) {
        return err.message || 'Google sign-in failed';
      }
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const appUser = await getOrCreateUserDoc(result.user);
      setUser(appUser);
      return 'ok';
    } catch (err: any) {
      return err.message || 'Google sign-in failed';
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const canEditGame = useCallback((gameId: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'developer') return user.assignedGames.includes(gameId);
    return false;
  }, [user]);

  const canSetRoles = useCallback((): boolean => {
    return user?.role === 'admin';
  }, [user]);

  const setUserRole = async (uid: string, role: Role): Promise<string> => {
    if (!user || user.role !== 'admin') return 'Permission denied';
    try {
      const updates: Record<string, any> = { role };
      if (role !== 'developer') updates.assignedGames = [];
      await updateDoc(doc(db, 'users', uid), updates);

      // If changing own role, update local state
      if (uid === user.uid) {
        setUser(prev => prev ? { ...prev, role, assignedGames: role !== 'developer' ? [] : prev.assignedGames } : null);
      }
      return 'ok';
    } catch {
      return 'Failed to update role';
    }
  };

  const assignGame = async (uid: string, gameId: string): Promise<string> => {
    if (!user) return 'Permission denied';
    // Admins can assign anyone; developers can self-assign
    if (user.role !== 'admin' && !(user.role === 'developer' && uid === user.uid)) return 'Permission denied';
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return 'User not found';
      const data = snap.data();
      if (data.role !== 'developer' && data.role !== 'admin') return 'User must be a developer or admin';
      const existing: string[] = data.assignedGames || [];
      if (!existing.includes(gameId)) {
        await updateDoc(userRef, { assignedGames: [...existing, gameId] });
      }
      return 'ok';
    } catch {
      return 'Failed to assign game';
    }
  };

  const unassignGame = async (uid: string, gameId: string): Promise<string> => {
    if (!user || user.role !== 'admin') return 'Permission denied';
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return 'User not found';
      const data = snap.data();
      await updateDoc(userRef, { assignedGames: (data.assignedGames || []).filter((id: string) => id !== gameId) });
      return 'ok';
    } catch {
      return 'Failed to unassign game';
    }
  };

  const getAllUsers = async () => {
    if (!user || user.role !== 'admin') return [];
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        uid: d.id,
        username: data.username as string,
        email: data.email as string,
        picture: (data.picture || '') as string,
        role: (data.role || 'user') as Role,
        assignedGames: (data.assignedGames || []) as string[],
      };
    });
  };

  const submitDeveloperRequest = async (message: string): Promise<string> => {
    if (!user) return 'Not logged in';
    if (user.role !== 'user') return 'Only regular users can request developer access';
    try {
      // Use uid as document ID so we can check existence without a query
      const reqRef = doc(db, 'developerRequests', user.uid);
      const existing = await getDoc(reqRef);
      if (existing.exists()) return 'You already have a pending request';
      await setDoc(reqRef, {
        uid: user.uid,
        username: user.username,
        email: user.email,
        picture: user.picture || '',
        message,
        createdAt: new Date().toISOString(),
      });
      return 'ok';
    } catch (err) {
      console.error('Developer request failed:', err);
      return 'Failed to submit request';
    }
  };

  const getDeveloperRequests = async (): Promise<DeveloperRequest[]> => {
    if (!user || user.role !== 'admin') return [];
    try {
      const snap = await getDocs(collection(db, 'developerRequests'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as DeveloperRequest));
    } catch (err) {
      console.error('Failed to fetch developer requests:', err);
      return [];
    }
  };

  const approveDeveloperRequest = async (requestId: string, uid: string): Promise<string> => {
    if (!user || user.role !== 'admin') return 'Permission denied';
    try {
      await updateDoc(doc(db, 'users', uid), { role: 'developer' });
      await deleteDoc(doc(db, 'developerRequests', requestId));
      return 'ok';
    } catch {
      return 'Failed to approve request';
    }
  };

  const denyDeveloperRequest = async (requestId: string): Promise<string> => {
    if (!user || user.role !== 'admin') return 'Permission denied';
    try {
      await deleteDoc(doc(db, 'developerRequests', requestId));
      return 'ok';
    } catch {
      return 'Failed to deny request';
    }
  };

  const deleteUser = async (uid: string): Promise<string> => {
    if (!user || user.role !== 'admin') return 'Permission denied';
    if (uid === user.uid) return 'Cannot delete your own account';
    try {
      await deleteDoc(doc(db, 'users', uid));
      // Also clean up any pending developer request for this user
      try { await deleteDoc(doc(db, 'developerRequests', uid)); } catch { /* ignore */ }
      // Also clean up any pending deletion request for this user
      try { await deleteDoc(doc(db, 'deletionRequests', uid)); } catch { /* ignore */ }
      return 'ok';
    } catch {
      return 'Failed to delete user';
    }
  };

  const submitDeletionRequest = async (reason: string): Promise<string> => {
    if (!user) return 'Not logged in';
    try {
      const reqRef = doc(db, 'deletionRequests', user.uid);
      const existing = await getDoc(reqRef);
      if (existing.exists()) return 'You already have a pending request';
      await setDoc(reqRef, {
        uid: user.uid,
        username: user.username,
        email: user.email,
        picture: user.picture || '',
        reason,
        createdAt: new Date().toISOString(),
      });
      return 'ok';
    } catch (err) {
      console.error('Deletion request failed:', err);
      return 'Failed to submit request';
    }
  };

  const getDeletionRequests = async (): Promise<DeletionRequest[]> => {
    if (!user || user.role !== 'admin') return [];
    try {
      const snap = await getDocs(collection(db, 'deletionRequests'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as DeletionRequest));
    } catch (err) {
      console.error('Failed to fetch deletion requests:', err);
      return [];
    }
  };

  const approveDeletionRequest = async (requestId: string, uid: string): Promise<string> => {
    if (!user || user.role !== 'admin') return 'Permission denied';
    try {
      await deleteDoc(doc(db, 'deletionRequests', requestId));
      await deleteUser(uid);
      return 'ok';
    } catch {
      return 'Failed to approve deletion request';
    }
  };

  const denyDeletionRequest = async (requestId: string): Promise<string> => {
    if (!user || user.role !== 'admin') return 'Permission denied';
    try {
      await deleteDoc(doc(db, 'deletionRequests', requestId));
      return 'ok';
    } catch {
      return 'Failed to deny deletion request';
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, canEditGame, canSetRoles, setUserRole, assignGame, unassignGame, getAllUsers, submitDeveloperRequest, getDeveloperRequests, approveDeveloperRequest, denyDeveloperRequest, deleteUser, submitDeletionRequest, getDeletionRequests, approveDeletionRequest, denyDeletionRequest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
