import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { ArrowLeft, Save, Trash2, Eye } from 'lucide-react';
import type { Game } from '../types/game';
import { Button } from '../components/ui/button';
import { Sidebar, SIDEBAR_WIDTH_CLASS } from '../components/Sidebar';
import { useAuth } from '../auth/AuthContext';
import { useGameStore } from '../data/GameStore';
import { EditorBasicInfo } from '../components/editor/EditorBasicInfo';
import { EditorTeam } from '../components/editor/EditorTeam';
import { EditorVisuals } from '../components/editor/EditorVisuals';
import { EditorDescriptionMedia } from '../components/editor/EditorDescriptionMedia';
import { EditorVisibility } from '../components/editor/EditorVisibility';
import { EditorCommunity } from '../components/editor/EditorCommunity';
import { EditorLauncherBehavior } from '../components/editor/EditorLauncherBehavior';
import { EditorCVars } from '../components/editor/EditorCVars';
import { EditorGameFiles } from '../components/editor/EditorGameFiles';
import { EditorAssignedDevs } from '../components/editor/EditorAssignedDevs';

export function GameEditorPage() {
  const { recompName } = useParams<{ recompName?: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, assignGame } = useAuth();
  const { games, saveGame, deleteGame } = useGameStore();

  const isNew = !recompName;
  const readOnly = pathname.endsWith('/preview');
  const isAdmin = user?.role === 'admin';

  const existingGame = useMemo(
    () => recompName ? (games.find(g => g.recompName.toLowerCase() === recompName.toLowerCase()) ?? null) : null,
    [games, recompName],
  );

  const [form, setForm] = useState<Game>(() => existingGame ?? {
    id: crypto.randomUUID(),
    title: '',
    recompName: '',
    og_developer: '',
    recompiled_developers: [],
    Tags: [],
    status: 'Unknown',
    coverImage: '',
    headerImage: [],
    description: '',
    isPublic: false,
    accentColor: '#000000',
    mediaLinks: [],
    platforms: ['Windows'],
    setGameDataRootToAssets: true,
    updateStatus: 'hidden',
    dlcNames: [],
  });

  const [recompNameError, setRecompNameError] = useState('');

  const update = <K extends keyof Game>(key: K, value: Game[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const duplicate = games.find(
      g => g.recompName.toLowerCase() === form.recompName.toLowerCase() && g.id !== form.id,
    );
    if (duplicate) {
      setRecompNameError(`Recomp name "${form.recompName}" is already used by "${duplicate.title}".`);
      return;
    }
    setRecompNameError('');
    await saveGame(form);
    if (isNew && user?.role === 'developer') {
      await assignGame(user.uid, form.id);
    }
    navigate(`/library/${form.recompName}`);
  };

  const handleDelete = () => {
    if (!existingGame) return;
    deleteGame(existingGame.id);
    navigate('/library');
  };

  const pageTitle = isNew
    ? 'Create New Game'
    : `${readOnly ? 'Preview' : 'Edit'}: ${existingGame?.title ?? recompName}`;

  const backTo = recompName ? `/library/${recompName}` : '/library';

  return (
    <div className={`flex h-screen flex-col relative overflow-hidden ${SIDEBAR_WIDTH_CLASS}`}>
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Sticky header */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(backTo)}
              className="shrink-0 p-1.5 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--theme-text-muted)' }}
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold truncate flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
              {readOnly && <Eye className="w-5 h-5 shrink-0" />}
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {readOnly ? (
              <Button type="button" onClick={() => navigate(backTo)} className="text-white" style={{ backgroundColor: 'var(--theme-item-selected)' }}>
                Close Preview
              </Button>
            ) : (
              <>
                {!isNew && existingGame && (
                  <Button type="button" onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                )}
                <Button type="submit" form="game-editor-form" className="text-white" style={{ backgroundColor: 'var(--theme-accent)' }}>
                  <Save className="w-4 h-4 mr-2" /> {isNew ? 'Create Game' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <form id="game-editor-form" onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <EditorBasicInfo
              form={form}
              update={update}
              readOnly={readOnly}
              recompNameError={recompNameError}
              onRecompNameChange={v => { update('recompName', v); setRecompNameError(''); }}
            />
            <EditorTeam form={form} update={update} readOnly={readOnly} />
            <EditorVisuals form={form} update={update} readOnly={readOnly} />
            <EditorDescriptionMedia form={form} update={update} readOnly={readOnly} />
            <EditorVisibility form={form} update={update} isAdmin={isAdmin} readOnly={readOnly} />
            <EditorCommunity form={form} update={update} readOnly={readOnly} />
            <EditorLauncherBehavior form={form} update={update} readOnly={readOnly} />
            <EditorCVars form={form} update={update} readOnly={readOnly} />
            <EditorGameFiles form={form} update={update} readOnly={readOnly} />
            {!isNew && <EditorAssignedDevs gameId={form.id} />}
          </form>
        </div>
      </div>
    </div>
  );
}
