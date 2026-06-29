import { useState, useEffect } from 'react';
import { X, Plus, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useGameDevelopers } from '../../data/useGameDevelopers';
import { EditorSection } from './EditorSection';

interface Props {
  gameId: string;
}

export function EditorAssignedDevs({ gameId }: Props) {
  const { user, getAllUsers, assignGame, unassignGame } = useAuth();
  const isAdmin = user?.role === 'admin';
  const assignedDevs = useGameDevelopers(gameId);

  const [allDevUsers, setAllDevUsers] = useState<{ uid: string; username: string; picture?: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Fetch all developer-role users when admin opens the add panel
  useEffect(() => {
    if (!panelOpen || !isAdmin) return;
    setLoadingUsers(true);
    getAllUsers()
      .then(users => setAllDevUsers(users.filter(u => u.role === 'developer' || u.role === 'admin')))
      .finally(() => setLoadingUsers(false));
  }, [panelOpen, isAdmin]);

  if (!isAdmin) return null;

  const assignedUids = new Set(assignedDevs.map(d => d.uid));
  const unassignedDevs = allDevUsers.filter(u => !assignedUids.has(u.uid));

  const handleAssign = async (uid: string) => {
    setAssigning(uid);
    setError('');
    const result = await assignGame(uid, gameId);
    if (result !== 'ok') setError(result);
    setAssigning(null);
  };

  const handleUnassign = async (uid: string) => {
    setUnassigning(uid);
    setError('');
    const result = await unassignGame(uid, gameId);
    if (result !== 'ok') setError(result);
    setUnassigning(null);
  };

  return (
    <EditorSection title="Assigned Developer Accounts">
      <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
        User accounts linked as developers of this game. They appear on the game page with their profile picture, and the game shows up in their library even when private.
      </p>

      {/* Currently assigned */}
      <div className="space-y-2">
        {assignedDevs.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>No accounts assigned yet.</p>
        )}
        {assignedDevs.map(dev => (
          <div
            key={dev.uid}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
            style={{ backgroundColor: 'var(--theme-page-bg)', border: '1px solid var(--theme-border)' }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {dev.picture ? (
                <img src={dev.picture} alt={dev.username} className="w-7 h-7 rounded-full shrink-0 object-cover" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--theme-item-selected)' }}
                >
                  {dev.username[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-sm truncate" style={{ color: 'var(--theme-text-primary)' }}>{dev.username}</span>
              <UserCheck className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--theme-accent)' }} />
            </div>
            <button
              type="button"
              onClick={() => handleUnassign(dev.uid)}
              disabled={unassigning === dev.uid}
              className="shrink-0 p-1 rounded hover:bg-red-600 hover:text-white transition-colors"
              style={{ color: 'var(--theme-text-muted)' }}
              title="Unassign"
            >
              {unassigning === dev.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>

      {/* Add developer panel */}
      {!panelOpen ? (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
          style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}
        >
          <Plus className="w-4 h-4" /> Assign a developer account
        </button>
      ) : (
        <div
          className="rounded-md border p-4 space-y-3"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-page-bg)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>Assign developer</span>
            <button type="button" onClick={() => setPanelOpen(false)} style={{ color: 'var(--theme-text-muted)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingUsers ? (
            <div className="flex items-center gap-2 py-2" style={{ color: 'var(--theme-text-muted)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading developer accounts…</span>
            </div>
          ) : unassignedDevs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
              {allDevUsers.length === 0 ? 'No developer accounts found.' : 'All developer accounts are already assigned.'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {unassignedDevs.map(dev => (
                <div
                  key={dev.uid}
                  className="flex items-center justify-between gap-3 rounded px-3 py-2"
                  style={{ backgroundColor: 'var(--theme-card-bg)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {dev.picture ? (
                      <img src={dev.picture} alt={dev.username} className="w-6 h-6 rounded-full shrink-0 object-cover" />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                        style={{ backgroundColor: 'var(--theme-item-selected)' }}
                      >
                        {dev.username[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm truncate" style={{ color: 'var(--theme-text-primary)' }}>{dev.username}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAssign(dev.uid)}
                    disabled={assigning === dev.uid}
                    className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded text-white"
                    style={{ backgroundColor: 'var(--theme-accent)' }}
                  >
                    {assigning === dev.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Assign
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </EditorSection>
  );
}
