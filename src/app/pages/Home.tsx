import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Download, Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Sidebar, SIDEBAR_WIDTH_CLASS } from '../components/Sidebar';
import { Footer } from '../components/Footer';
import { CoverArtBackground } from '../components/CoverArtBackground';
import { GameGrid } from '../components/GameGrid';
import { ContentEditor, EditButton } from '../components/ContentEditor';
import { Markdown } from '../components/Markdown';
import { useGameStore } from '../data/GameStore';
import { useAuth } from '../auth/AuthContext';
import { useRatings } from '../data/useRatings';
import { useSiteContent } from '../data/useSiteContent';
import { useTheme } from '../theme/ThemeContext';
import { Game } from '../types/game';

const DEFAULT_TAGLINE =
  'A community driven launcher and library for Xbox 360 recompilations made with RexGlue. Browse the catalog, rate the recomps, and play restored experiences on modern hardware.';

export function Home() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { games, getVisibleGames } = useGameStore();
  const { gameRatings } = useRatings(user?.uid);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInCEF, setIsInCEF] = useState(false);
  const tagline = useSiteContent<{ text: string }>('homeTagline', { text: DEFAULT_TAGLINE });
  const [taglineEditorOpen, setTaglineEditorOpen] = useState(false);

  const DEFAULT_REXGLUE_DESC = 'The official community server for the RexGlue SDK. Learn how to make your own recompilations, Thank the developers, and stay up to date on the more technical aspects of the SDK.';
  const DEFAULT_GOOPIE_DESC = 'Get help, report bugs, and stay up to date with the Goopie launcher. Feel free to ask questions about any recomp on our launcher as well, we try to monitor the quality of each recomp to make sure they are up to standard with the tags we give them.';
  const DEFAULT_COMMUNITY_HEADING = 'Join the Community';
  const DEFAULT_COMMUNITY_SUBTITLE = 'Get support, share feedback, stay up to date, and chat with other players.';
  const rexGlueDesc = useSiteContent<{ text: string }>('discordRexGlue', { text: DEFAULT_REXGLUE_DESC });
  const goopieDesc = useSiteContent<{ text: string }>('discordGoopie', { text: DEFAULT_GOOPIE_DESC });
  const communityHeading = useSiteContent<{ text: string }>('communityHeading', { text: DEFAULT_COMMUNITY_HEADING });
  const communitySubtitle = useSiteContent<{ text: string }>('communitySubtitle', { text: DEFAULT_COMMUNITY_SUBTITLE });
  const [rexGlueEditorOpen, setRexGlueEditorOpen] = useState(false);
  const [goopieEditorOpen, setGoopieEditorOpen] = useState(false);
  const [communityHeadingEditorOpen, setCommunityHeadingEditorOpen] = useState(false);
  const [communitySubtitleEditorOpen, setCommunitySubtitleEditorOpen] = useState(false);

  type FaqEntry = { id: string; question: string; answer: string };
  const faq = useSiteContent<{ items: FaqEntry[] }>('homeFaq', { items: [] });
  const [faqOpen, setFaqOpen] = useState<string | null>(null);
  const [editingFaq, setEditingFaq] = useState<FaqEntry | null>(null);
  const [addingFaq, setAddingFaq] = useState(false);
  const [faqDraft, setFaqDraft] = useState<{ question: string; answer: string }>({ question: '', answer: '' });

  const saveFaqItems = (items: FaqEntry[]) => faq.save({ items });

  const addFaqEntry = () => {
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return;
    const newItems = [...(faq.value.items || []), { id: crypto.randomUUID(), ...faqDraft }];
    saveFaqItems(newItems);
    setFaqDraft({ question: '', answer: '' });
    setAddingFaq(false);
  };

  const updateFaqEntry = (updated: FaqEntry) => {
    const newItems = (faq.value.items || []).map(e => e.id === updated.id ? updated : e);
    saveFaqItems(newItems);
    setEditingFaq(null);
  };

  const deleteFaqEntry = (id: string) => {
    saveFaqItems((faq.value.items || []).filter(e => e.id !== id));
  };

  useEffect(() => {
    setIsInCEF(typeof (window as any).GetPlatform === 'function');
  }, []);

  const visibleGames = useMemo(
    () => getVisibleGames(user?.role, user?.assignedGames || []),
    [games, user, getVisibleGames]
  );

  const sortedGames = useMemo(() => {
    const statusOrder: Record<Game['status'], number> = {
      Featured: 0,
      Enhanced: 1,
      Playable: 2,
      Gameplay: 3,
      Loads: 4,
      Unplayable: 5,
      Unknown: 6,
    };
    let totalSum = 0;
    let totalCount = 0;
    for (const info of Object.values(gameRatings)) {
      totalSum += info.averageRating * info.totalRatings;
      totalCount += info.totalRatings;
    }
    const C = totalCount > 0 ? totalSum / totalCount : 0;
    const m = 3;
    return [...visibleGames]
      .filter(g => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          g.title.toLowerCase().includes(q) ||
          g.og_developer.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const sd = statusOrder[a.status] - statusOrder[b.status];
        if (sd !== 0) return sd;
        const ia = gameRatings[a.id];
        const ib = gameRatings[b.id];
        const ra = ia?.averageRating ?? 0;
        const rb = ib?.averageRating ?? 0;
        const va = ia?.totalRatings ?? 0;
        const vb = ib?.totalRatings ?? 0;
        if (ra === rb) return vb - va;
        const wA = ia ? (va / (va + m)) * ra + (m / (va + m)) * C : 0;
        const wB = ib ? (vb / (vb + m)) * rb + (m / (vb + m)) * C : 0;
        if (wA !== wB) return wB - wA;
        return vb - va;
      });
  }, [visibleGames, searchQuery, gameRatings]);

  const scrollToGames = () => {
    document.getElementById('home-games-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* Fixed cover art background – stays locked to viewport while scrolling */}
      <CoverArtBackground games={visibleGames} zIndex={0} overlayColor={colors.coverOverlayColor} />

      <div
        className={`min-h-screen flex flex-col ${SIDEBAR_WIDTH_CLASS}`}
        style={{ color: 'var(--theme-text-primary)' }}
      >
      <Sidebar />
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isInCEF={isInCEF}
      />

      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6 py-20 md:py-28 min-h-[80vh]"
      >
        <img
          src="https://x02.me/i/EQQTVA.png"
          alt="Goopie logo"
          className="relative z-10 w-40 h-40 md:w-56 md:h-56 object-contain mb-6"
          style={{ filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.95)) drop-shadow(0 4px 8px rgba(0,0,0,0.85))' }}
        />
        <h1
          className="relative z-10 text-6xl md:text-8xl font-bold mb-6 select-none"
          style={{
            fontFamily: '"Chewy", cursive',
            color: '#ffffff',
            letterSpacing: '0.05em',
            lineHeight: 1.25,
            paddingBottom: '0.15em',
            paddingLeft: '0.1em',
            paddingRight: '0.1em',
            textShadow: '0 6px 18px rgba(0,0,0,0.95), 0 3px 6px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          Goopie
        </h1>
        <div
          className="relative z-10 max-w-2xl mb-10 px-6 py-5 rounded-xl"
          style={{
            backgroundColor: 'var(--theme-section-overlay)',
            border: '1px solid var(--theme-border)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        >
          <p
            className="text-lg md:text-xl leading-relaxed"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            {tagline.value.text || DEFAULT_TAGLINE}
          </p>
          {tagline.isAdmin && (
            <div className="mt-3 flex justify-end">
              <EditButton onClick={() => setTaglineEditorOpen(true)} label="Edit tagline" />
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
          {!isInCEF && (
            <Link
              to="/downloads"
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-base font-semibold transition-opacity hover:opacity-90 w-full sm:w-auto justify-center"
              style={{
                background: `linear-gradient(to bottom right, var(--theme-gradient-from), var(--theme-gradient-to))`,
                color: 'var(--theme-text-primary)',
                boxShadow: '0 10px 28px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.6)',
              }}
            >
              <Download className="w-5 h-5" />
              Download the Launcher
            </Link>
          )}
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 mt-4">
          <button
            onClick={scrollToGames}
            className="px-6 py-3 rounded-lg text-base font-semibold transition-opacity hover:opacity-90"
            style={{
              background: `linear-gradient(to bottom right, var(--theme-gradient-from), var(--theme-gradient-to))`,
              color: 'var(--theme-text-primary)',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.6)',
            }}
          >
            Browse Games
          </button>
          <Link
            to="/library"
            className="px-6 py-3 rounded-lg text-base font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--theme-item-selected)',
              color: 'var(--theme-text-primary)',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.6)',
            }}
          >
            Open Library
          </Link>
        </div>

        <button
          onClick={scrollToGames}
          aria-label="Scroll to games"
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-bounce p-2 rounded-full"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <ChevronDown className="w-8 h-8" />
        </button>
      </section>

      {/* Games grid */}
      <section
        id="home-games-grid"
        className="px-4 md:px-10 py-12 md:py-16 border-t"
        style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-section-overlay)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', position: 'relative', zIndex: 1 }}
      >
        <div className="max-w-7xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            Game Library
          </h2>
          <p
            className="text-sm md:text-base mb-8"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            {sortedGames.length} {sortedGames.length === 1 ? 'game' : 'games'} available
          </p>

          <GameGrid games={sortedGames} ratings={gameRatings} />
        </div>
      </section>

      {/* Community / Discord */}
      {!isInCEF && (
        <section
          id="home-community"
          className="px-4 md:px-10 py-12 md:py-16 border-t"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-section-overlay)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', position: 'relative', zIndex: 1 }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <h2
                className="text-3xl md:text-4xl font-bold"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                {communityHeading.value.text || DEFAULT_COMMUNITY_HEADING}
              </h2>
              {communityHeading.isAdmin && (
                <EditButton onClick={() => setCommunityHeadingEditorOpen(true)} label="Edit heading" />
              )}
            </div>
            <div className="flex items-center gap-2 mb-8">
              <p
                className="text-sm md:text-base max-w-2xl"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                {communitySubtitle.value.text || DEFAULT_COMMUNITY_SUBTITLE}
              </p>
              {communitySubtitle.isAdmin && (
                <EditButton onClick={() => setCommunitySubtitleEditorOpen(true)} label="Edit subtitle" />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left — RexGlue community */}
              <div
                className="rounded-xl p-5 flex flex-col gap-4"
                style={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)' }}
              >
                <div>
                  <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--theme-text-primary)' }}>RexGlue Community</h3>
                  <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                    {rexGlueDesc.value.text || DEFAULT_REXGLUE_DESC}
                  </p>
                  {rexGlueDesc.isAdmin && (
                    <div className="mt-2">
                      <EditButton onClick={() => setRexGlueEditorOpen(true)} label="Edit description" />
                    </div>
                  )}
                </div>
                <a
                  href="https://discord.gg/CNTxwSNZfT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-semibold transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                  Join Server
                </a>
                <iframe
                  src="https://discord.com/widget?id=1461417878891921523&theme=dark"
                  width="100%"
                  height="400"
                  allowTransparency={true}
                  frameBorder={0}
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                  className="rounded-lg w-full block"
                  title="RexGlue Community Discord"
                />
              </div>

              {/* Right — Goopie support */}
              <div
                className="rounded-xl p-5 flex flex-col gap-4"
                style={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)' }}
              >
                <div>
                  <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--theme-text-primary)' }}>Goopie Support</h3>
                  <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                    {goopieDesc.value.text || DEFAULT_GOOPIE_DESC}
                  </p>
                  {goopieDesc.isAdmin && (
                    <div className="mt-2">
                      <EditButton onClick={() => setGoopieEditorOpen(true)} label="Edit description" />
                    </div>
                  )}
                </div>
                <a
                  href="https://discord.gg/vq4GcEs46M"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-semibold transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                  Join Server
                </a>
                <iframe
                  src="https://discord.com/widget?id=1513356298874388640&theme=dark"
                  width="100%"
                  height="400"
                  allowTransparency={true}
                  frameBorder={0}
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                  className="rounded-lg w-full block"
                  title="Goopie Support Discord"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {(!isInCEF && (faq.value.items?.length > 0 || faq.isAdmin)) && (
        <section
          id="home-faq"
          className="px-4 md:px-10 py-12 md:py-16 border-t"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-section-overlay)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', position: 'relative', zIndex: 1 }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <h2
                className="text-3xl md:text-4xl font-bold"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                Frequently Asked Questions
              </h2>
              {faq.isAdmin && (
                <button
                  onClick={() => { setFaqDraft({ question: '', answer: '' }); setAddingFaq(true); setEditingFaq(null); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors bg-[#5865F2] hover:bg-[#4752c4] text-white"
                  title="Add FAQ entry"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              )}
            </div>

            <div
              className="rounded-xl overflow-hidden divide-y"
              style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', border: '1px solid var(--theme-border)' }}
            >
              {(faq.value.items || []).map((entry) => (
                <div key={entry.id}>
                  {/* Edit mode */}
                  {editingFaq?.id === entry.id ? (
                    <div className="p-4 space-y-3">
                      <input
                        className="w-full rounded-md px-3 py-2 text-sm border outline-none"
                        style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                        value={editingFaq.question}
                        onChange={e => setEditingFaq({ ...editingFaq, question: e.target.value })}
                        placeholder="Question"
                      />
                      <textarea
                        className="w-full rounded-md px-3 py-2 text-sm border outline-none resize-y min-h-[80px]"
                        style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                        value={editingFaq.answer}
                        onChange={e => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                        placeholder="Answer"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateFaqEntry(editingFaq)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={() => setEditingFaq(null)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                          style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div>
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:opacity-80 transition-opacity"
                        onClick={() => setFaqOpen(faqOpen === entry.id ? null : entry.id)}
                      >
                        <span className="font-semibold text-sm md:text-base" style={{ color: 'var(--theme-text-primary)' }}>
                          {entry.question}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {faq.isAdmin && (
                            <>
                              <span
                                role="button"
                                onClick={e => { e.stopPropagation(); setEditingFaq({ ...entry }); setAddingFaq(false); }}
                                className="p-1 rounded hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--theme-text-muted)' }}
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </span>
                              <span
                                role="button"
                                onClick={e => { e.stopPropagation(); deleteFaqEntry(entry.id); }}
                                className="p-1 rounded hover:opacity-70 transition-opacity text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </span>
                            </>
                          )}
                          <ChevronDown
                            className="w-4 h-4 transition-transform duration-200"
                            style={{ color: 'var(--theme-text-muted)', transform: faqOpen === entry.id ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          />
                        </div>
                      </button>
                      {faqOpen === entry.id && (
                        <div className="px-5 pb-5">
                          <div className="text-sm leading-relaxed prose-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                            <Markdown source={entry.answer} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add new entry form */}
              {addingFaq && faq.isAdmin && (
                <div className="p-4 space-y-3">
                  <input
                    className="w-full rounded-md px-3 py-2 text-sm border outline-none"
                    style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                    value={faqDraft.question}
                    onChange={e => setFaqDraft(d => ({ ...d, question: e.target.value }))}
                    placeholder="Question"
                    autoFocus
                  />
                  <textarea
                    className="w-full rounded-md px-3 py-2 text-sm border outline-none resize-y min-h-[80px]"
                    style={{ backgroundColor: 'var(--theme-page-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                    value={faqDraft.answer}
                    onChange={e => setFaqDraft(d => ({ ...d, answer: e.target.value }))}
                    placeholder="Answer"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addFaqEntry}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors"
                    >
                      <Check className="w-3 h-3" /> Add
                    </button>
                    <button
                      onClick={() => setAddingFaq(false)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                      style={{ backgroundColor: 'var(--theme-item-selected)', color: 'var(--theme-text-primary)' }}
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state for admins */}
              {faq.isAdmin && (faq.value.items || []).length === 0 && !addingFaq && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>No FAQ entries yet. Click "Add" to create the first one.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Quick navigation – fixed bottom-right */}
      <div className="fixed right-4 bottom-16 z-40 flex flex-col items-end gap-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-100 opacity-60"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text-primary)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          ↑ Top
        </button>
        <button
          onClick={() => document.getElementById('home-games-grid')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-100 opacity-60"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text-primary)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          Game Library
        </button>
        {!isInCEF && (
          <button
            onClick={() => document.getElementById('home-community')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-100 opacity-60"
            style={{
              backgroundColor: 'var(--theme-card-bg)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text-primary)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            Community
          </button>
        )}
        {!isInCEF && (faq.value.items?.length > 0 || faq.isAdmin) && (
          <button
            onClick={() => document.getElementById('home-faq')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-100 opacity-60"
            style={{
              backgroundColor: 'var(--theme-card-bg)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text-primary)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            FAQ
          </button>
        )}
      </div>

      <Footer />

      <ContentEditor
        open={communityHeadingEditorOpen}
        title="Edit community section heading"
        fields={[
          {
            key: 'text',
            label: 'Heading',
            placeholder: DEFAULT_COMMUNITY_HEADING,
          },
        ]}
        initial={{ text: communityHeading.value.text || DEFAULT_COMMUNITY_HEADING }}
        onClose={() => setCommunityHeadingEditorOpen(false)}
        onSave={(vals) => communityHeading.save({ text: vals.text })}
      />
      <ContentEditor
        open={communitySubtitleEditorOpen}
        title="Edit community section subtitle"
        fields={[
          {
            key: 'text',
            label: 'Subtitle',
            multiline: true,
            placeholder: DEFAULT_COMMUNITY_SUBTITLE,
          },
        ]}
        initial={{ text: communitySubtitle.value.text || DEFAULT_COMMUNITY_SUBTITLE }}
        onClose={() => setCommunitySubtitleEditorOpen(false)}
        onSave={(vals) => communitySubtitle.save({ text: vals.text })}
      />
      <ContentEditor
        open={rexGlueEditorOpen}
        title="Edit RexGlue Community description"
        fields={[
          {
            key: 'text',
            label: 'Description',
            multiline: true,
            placeholder: DEFAULT_REXGLUE_DESC,
          },
        ]}
        initial={{ text: rexGlueDesc.value.text || DEFAULT_REXGLUE_DESC }}
        onClose={() => setRexGlueEditorOpen(false)}
        onSave={(vals) => rexGlueDesc.save({ text: vals.text })}
      />
      <ContentEditor
        open={goopieEditorOpen}
        title="Edit Goopie Support description"
        fields={[
          {
            key: 'text',
            label: 'Description',
            multiline: true,
            placeholder: DEFAULT_GOOPIE_DESC,
          },
        ]}
        initial={{ text: goopieDesc.value.text || DEFAULT_GOOPIE_DESC }}
        onClose={() => setGoopieEditorOpen(false)}
        onSave={(vals) => goopieDesc.save({ text: vals.text })}
      />
      <ContentEditor
        open={taglineEditorOpen}
        title="Edit homepage tagline"
        fields={[
          {
            key: 'text',
            label: 'Tagline',
            multiline: true,
            placeholder: DEFAULT_TAGLINE,
            helperText: 'Shown in the hero section under the Goopie logo.',
          },
        ]}
        initial={{ text: tagline.value.text || DEFAULT_TAGLINE }}
        onClose={() => setTaglineEditorOpen(false)}
        onSave={(vals) => tagline.save({ text: vals.text })}
      />
    </div>
  </>
  );
}
