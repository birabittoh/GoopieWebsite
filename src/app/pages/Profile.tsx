import { useState, useEffect, useMemo } from 'react';
import { Trophy, LogOut, Shield, Code, UserIcon, Plus, X, Search, Clock, CheckCircle2, XCircle, MessageSquare, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Game } from '../types/game';
import { useAuth, type Role, type DeveloperRequest, type DeletionRequest } from '../auth/AuthContext';
import { useGameStore } from '../data/GameStore';
import { useAchievementStats } from '../data/useAchievementStats';

const statusColors: Record<Game['status'], string> = {
  Featured: 'bg-purple-600 text-white',
  Enhanced: 'bg-blue-500 text-white',
  Playable: 'bg-green-700 text-white',
  Gameplay: 'bg-green-400 text-black',
  Loads: 'bg-orange-500 text-white',
  Unplayable: 'bg-red-500 text-white',
  Unknown: 'bg-gray-600 text-white',
};

export function Profile() {
  const { user, logout, canSetRoles, setUserRole, assignGame, unassignGame, getAllUsers, submitDeveloperRequest, getDeveloperRequests, approveDeveloperRequest, denyDeveloperRequest, deleteUser, submitDeletionRequest, getDeletionRequests, approveDeletionRequest, denyDeletionRequest } = useAuth();
  const { games, saveGame } = useGameStore();
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState<{ uid: string; username: string; email: string; role: Role; assignedGames: string[]; picture?: string }[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [devRequestOpen, setDevRequestOpen] = useState(false);
  const [devRequestMessage, setDevRequestMessage] = useState('');
  const [devRequestStatus, setDevRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'already'>('idle');
  const [devRequests, setDevRequests] = useState<DeveloperRequest[]>([]);
  const [deleteConfirmUid, setDeleteConfirmUid] = useState<string | null>(null);
  const [deletionRequestOpen, setDeletionRequestOpen] = useState(false);
  const [deletionRequestReason, setDeletionRequestReason] = useState('');
  const [deletionRequestStatus, setDeletionRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'already'>('idle');
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);

  const totalGames = games.length;

  const pendingGames = useMemo(() => games.filter(g => g.pendingApproval && !g.isPublic), [games]);

  const achievementStats = useAchievementStats(games);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [allUsers, userSearch]);

  // Load users list for admin panel
  const refreshUsers = () => {
    if (canSetRoles()) {
      getAllUsers().then(setAllUsers);
      getDeveloperRequests().then(setDevRequests);
      getDeletionRequests().then(setDeletionRequests);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const statusCounts = games.reduce((acc, game) => {
    acc[game.status] = (acc[game.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const roleColors: Record<Role, string> = {
    admin: 'bg-yellow-500 text-black',
    developer: 'bg-purple-500 text-white',
    user: 'bg-gray-500 text-white',
  };

  const roleIcons: Record<Role, typeof Shield> = {
    admin: Shield,
    developer: Code,
    user: UserIcon,
  };

  const RoleIcon = user ? roleIcons[user.role] : UserIcon;

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
      {/* Header */}
      <div className="border-b relative z-10" style={{ backgroundColor: 'var(--theme-topbar-bg)', borderColor: 'var(--theme-border)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2" style={{ color: 'var(--theme-text-primary)' }}>{user?.username || 'Guest'}</h1>
            <p className="text-sm md:text-base" style={{ color: 'var(--theme-text-muted)' }}>Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link to="/library" className="flex-1 md:flex-none">
              <Button className="text-white w-full" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
                Back to Library
              </Button>
            </Link>
            <Button
              onClick={() => { logout(); navigate('/login'); }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
        {/* Profile Header */}
        <div className="rounded-lg p-4 md:p-8 mb-8" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            {user?.picture ? (
              <img src={user.picture} alt={user.username} className="w-20 h-20 md:w-32 md:h-32 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-20 h-20 md:w-32 md:h-32 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--theme-gradient-from), var(--theme-gradient-to))' }}>
                <span className="text-3xl md:text-5xl font-bold text-white">{user?.username?.[0]?.toUpperCase() || '?'}</span>
              </div>
            )}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3 mb-2">
                <h2 className="text-2xl md:text-4xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>{user?.username || 'Guest'}</h2>
                {user && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${roleColors[user.role]}`}>
                    <RoleIcon className="w-3 h-3" />
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--theme-text-muted)' }} className="mb-4">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}</p>
              <div className="flex flex-wrap gap-3">
                {user?.role === 'user' && (
                  <Button
                    onClick={() => { setDevRequestOpen(true); setDevRequestStatus('idle'); setDevRequestMessage(''); }}
                    className="text-white"
                    style={{ backgroundColor: 'var(--theme-item-selected)' }}
                  >
                    <Code className="w-4 h-4 mr-2" />
                    Request Developer Access
                  </Button>
                )}
                <Button
                  onClick={() => { setDeletionRequestOpen(true); setDeletionRequestStatus('idle'); setDeletionRequestReason(''); }}
                  variant="outline"
                  className="border-red-600 text-red-500 hover:bg-red-600 hover:text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Request Account Deletion
                </Button>
              </div>
              {achievementStats && (
                <div className="flex gap-6">
                  <div className="flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                    <Trophy className="w-5 h-5" style={{ color: '#f5c518' }} />
                    <span className="font-bold">{achievementStats.earnedScore}G</span>
                    <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                      gamer cred
                      {achievementStats.total > 0 && (
                        <> &middot; {achievementStats.unlocked}/{achievementStats.total} achievements</>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Deletion Requests (Admin) */}
        {canSetRoles() && deletionRequests.length > 0 && (
          <div className="rounded-lg p-8 mt-8" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{ color: 'var(--theme-text-primary)' }}>
              <Trash2 className="w-6 h-6 text-red-500" />
              Account Deletion Requests ({deletionRequests.length})
            </h3>
            <div className="space-y-4">
              {deletionRequests.map(req => (
                <div key={req.id} className="rounded-lg p-4" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {req.picture ? (
                        <img src={req.picture} alt={req.username} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--theme-gradient-from), var(--theme-gradient-to))' }}>
                          <span className="text-lg font-bold text-white">{req.username[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{req.username}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--theme-text-muted)' }}>{req.email}</span>
                        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                          {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => { await approveDeletionRequest(req.id, req.uid); refreshUsers(); }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete Account
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => { await denyDeletionRequest(req.id); refreshUsers(); }}
                        className="text-white"
                        style={{ backgroundColor: 'var(--theme-item-selected)' }}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Deny
                      </Button>
                    </div>
                  </div>
                  {req.reason && (
                    <div className="rounded-md p-3 mt-2" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
                      <p className="text-sm italic" style={{ color: 'var(--theme-text-primary)' }}>"{req.reason}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Developer Access Requests (Admin) */}
        {canSetRoles() && devRequests.length > 0 && (
          <div className="rounded-lg p-8 mt-8" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{ color: 'var(--theme-text-primary)' }}>
              <MessageSquare className="w-6 h-6 text-purple-500" />
              Developer Requests ({devRequests.length})
            </h3>
            <div className="space-y-4">
              {devRequests.map(req => (
                <div key={req.id} className="rounded-lg p-4" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {req.picture ? (
                        <img src={req.picture} alt={req.username} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--theme-gradient-from), var(--theme-gradient-to))' }}>
                          <span className="text-lg font-bold text-white">{req.username[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{req.username}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--theme-text-muted)' }}>{req.email}</span>
                        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                          {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => { await approveDeveloperRequest(req.id, req.uid); refreshUsers(); }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => { await denyDeveloperRequest(req.id); refreshUsers(); }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Deny
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md p-3 mt-2" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
                    <p className="text-sm italic" style={{ color: 'var(--theme-text-primary)' }}>"{req.message}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Game Approval Section */}
        {canSetRoles() && pendingGames.length > 0 && (
          <div className="rounded-lg p-4 md:p-8 mt-8" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
            <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 flex items-center gap-3" style={{ color: 'var(--theme-text-primary)' }}>
              <Clock className="w-6 h-6 text-yellow-500" />
              Pending Approval ({pendingGames.length})
            </h3>
            <div className="space-y-4">
              {pendingGames.map(game => (
                <div key={game.id} className="rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
                  <div className="flex items-center gap-4">
                    {game.coverImage && (
                      <img src={game.coverImage} alt={game.title} className="w-16 h-16 rounded object-cover" />
                    )}
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{game.title}</span>
                      <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{game.og_developer} — {game.recompiled_developers.join(', ')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => { await saveGame({ ...game, isPublic: true, pendingApproval: false }); }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => { await saveGame({ ...game, pendingApproval: false }); }}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canSetRoles() && (
          <div className="rounded-lg p-4 md:p-8 mt-8" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
            <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 flex items-center gap-3" style={{ color: 'var(--theme-text-primary)' }}>
              <Shield className="w-6 h-6 text-yellow-500" />
              User Management
            </h3>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--theme-text-muted)' }} />
              <Input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users by name or email..."
                className="pl-10"
                style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
              />
            </div>
            <div className="space-y-4">
              {filteredUsers.map((u) => {
                const TargetRoleIcon = roleIcons[u.role];
                return (
                  <div key={u.uid} className="rounded-lg p-4" style={{ backgroundColor: 'var(--theme-page-bg)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.picture ? (
                          <img src={u.picture} alt={u.username} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--theme-gradient-from), var(--theme-gradient-to))' }}>
                            <span className="text-lg font-bold text-white">{u.username[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <div>
                          <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{u.username}</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--theme-text-muted)' }}>{u.email}</span>
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${roleColors[u.role]}`}>
                            <TargetRoleIcon className="w-2.5 h-2.5" />
                            {u.role}
                          </span>
                        </div>
                      </div>
                      {u.uid !== user?.uid && (
                        <div className="flex flex-wrap gap-2 items-center">
                          {(['admin', 'developer', 'user'] as Role[]).map(role => (
                            <Button
                              key={role}
                              size="sm"
                              disabled={u.role === role}
                              onClick={async () => { await setUserRole(u.uid, role); refreshUsers(); }}
                              className={u.role === role
                                ? 'cursor-not-allowed opacity-50 text-white'
                                : 'text-white'}
                              style={{ backgroundColor: 'var(--theme-item-selected)' }}
                            >
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            onClick={() => setDeleteConfirmUid(u.uid)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            title="Delete profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Assigned games for developers */}
                    {u.role === 'developer' && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                        <p className="text-sm mb-2" style={{ color: 'var(--theme-text-muted)' }}>Assigned Games:</p>
                        <div className="flex flex-wrap gap-2">
                          {u.assignedGames.map(gid => {
                            const game = games.find(g => g.id === gid);
                            return game ? (
                              <span key={gid} className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                                {game.title}
                                <button
                                  onClick={async () => { await unassignGame(u.uid, gid); refreshUsers(); }}
                                  className="hover:text-white ml-1"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ) : null;
                          })}
                          {games.filter(g => !u.assignedGames.includes(g.id)).length > 0 && (
                            <div className="relative group">
                              <button className="text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 transition-colors" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
                                <Plus className="w-3 h-3" /> Assign
                              </button>
                              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block border rounded-lg shadow-xl z-10 min-w-[200px]" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                                {games.filter(g => !u.assignedGames.includes(g.id)).map(game => (
                                  <button
                                    key={game.id}
                                    onClick={async () => { await assignGame(u.uid, game.id); refreshUsers(); }}
                                    className="block w-full text-left px-4 py-2 text-sm first:rounded-t-lg last:rounded-b-lg"
                                    style={{ color: 'var(--theme-text-primary)' }}
                                  >
                                    {game.title}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Request Account Deletion Dialog */}
      <Dialog open={deletionRequestOpen} onOpenChange={setDeletionRequestOpen}>
        <DialogContent style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Request Account Deletion</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
              Your request will be reviewed by an admin before your account is permanently deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletionRequestStatus === 'sent' ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p style={{ color: 'var(--theme-text-primary)' }}>Your deletion request has been submitted.</p>
              <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>An admin will review it soon.</p>
            </div>
          ) : deletionRequestStatus === 'already' ? (
            <div className="py-4 text-center">
              <Clock className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
              <p style={{ color: 'var(--theme-text-primary)' }}>You already have a pending deletion request.</p>
              <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>Please wait for an admin to review it.</p>
            </div>
          ) : (
            <>
              <Textarea
                value={deletionRequestReason}
                onChange={e => setDeletionRequestReason(e.target.value)}
                placeholder="Optional: tell us why you'd like your account deleted."
                rows={3}
                style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
              />
              {deletionRequestStatus === 'error' && (
                <p className="text-sm text-red-500">Failed to submit request. Please try again.</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletionRequestOpen(false)} style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)', backgroundColor: 'transparent' }}>
                  Cancel
                </Button>
                <Button
                  disabled={deletionRequestStatus === 'sending'}
                  onClick={async () => {
                    setDeletionRequestStatus('sending');
                    const result = await submitDeletionRequest(deletionRequestReason.trim());
                    if (result === 'ok') setDeletionRequestStatus('sent');
                    else if (result === 'You already have a pending request') setDeletionRequestStatus('already');
                    else setDeletionRequestStatus('error');
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deletionRequestStatus === 'sending' ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Developer Access Dialog */}
      <Dialog open={devRequestOpen} onOpenChange={setDevRequestOpen}>
        <DialogContent style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Request Developer Access</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
              Tell the admins why you'd like developer access. Your message will be reviewed before a decision is made.
            </DialogDescription>
          </DialogHeader>
          {devRequestStatus === 'sent' ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p style={{ color: 'var(--theme-text-primary)' }}>Your request has been submitted!</p>
              <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>An admin will review it soon.</p>
            </div>
          ) : devRequestStatus === 'already' ? (
            <div className="py-4 text-center">
              <Clock className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
              <p style={{ color: 'var(--theme-text-primary)' }}>You already have a pending request.</p>
              <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>Please wait for an admin to review it.</p>
            </div>
          ) : (
            <>
              <Textarea
                value={devRequestMessage}
                onChange={e => setDevRequestMessage(e.target.value)}
                placeholder="Why would you like developer access? What games do you plan to work on?"
                rows={4}
                style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
              />
              {devRequestStatus === 'error' && (
                <p className="text-sm text-red-500">Failed to submit request. Please try again.</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDevRequestOpen(false)} style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)', backgroundColor: 'transparent' }}>
                  Cancel
                </Button>
                <Button
                  disabled={!devRequestMessage.trim() || devRequestStatus === 'sending'}
                  onClick={async () => {
                    setDevRequestStatus('sending');
                    const result = await submitDeveloperRequest(devRequestMessage.trim());
                    if (result === 'ok') setDevRequestStatus('sent');
                    else if (result === 'You already have a pending request') setDevRequestStatus('already');
                    else setDevRequestStatus('error');
                  }}
                  className="text-white"
                  style={{ backgroundColor: 'var(--theme-item-selected)' }}
                >
                  {devRequestStatus === 'sending' ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={!!deleteConfirmUid} onOpenChange={open => { if (!open) setDeleteConfirmUid(null); }}>
        <DialogContent style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text-primary)' }}>Delete Profile</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-muted)' }}>
              Are you sure you want to delete{' '}
              <strong style={{ color: 'var(--theme-text-primary)' }}>
                {allUsers.find(u => u.uid === deleteConfirmUid)?.username ?? 'this user'}
              </strong>
              's profile? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmUid(null)}
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)', backgroundColor: 'transparent' }}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (deleteConfirmUid) {
                  await deleteUser(deleteConfirmUid);
                  setDeleteConfirmUid(null);
                  refreshUsers();
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}