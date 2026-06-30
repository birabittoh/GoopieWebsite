import { useState, useEffect } from 'react';
import { Trophy, Lock } from 'lucide-react';

interface Achievement {
  id: number;
  label: string;
  description: string;
  unachievedDescription: string;
  iconDataUrl: string;
  gamerscore: number;
  flags: number;
  unlocked: boolean;
  unlockFiletime: number;
}

interface AchievementsPanelProps {
  recompName: string;
}

export function AchievementsPanel({ recompName }: AchievementsPanelProps) {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);

  useEffect(() => {
    const w = window as any;
    if (typeof w.getAchievements !== 'function') return;
    const result = w.getAchievements(recompName);
    setAchievements(Array.isArray(result) ? result : []);
  }, [recompName]);

  if (achievements === null) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
        Loading achievements…
      </p>
    );
  }

  if (achievements.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--theme-text-muted)' }}>
        No achievements found for this game.
      </p>
    );
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const total = achievements.length;
  const earnedScore = achievements.filter(a => a.unlocked).reduce((s, a) => s + a.gamerscore, 0);
  const totalScore = achievements.reduce((s, a) => s + a.gamerscore, 0);
  const progressPct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Header / summary */}
      <div
        className="p-3 rounded-lg space-y-2"
        style={{ backgroundColor: 'var(--theme-item-default)' }}
      >
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--theme-text-primary)' }}>
            <span className="font-semibold">{unlockedCount}</span>
            <span style={{ color: 'var(--theme-text-muted)' }}> / {total} unlocked</span>
          </span>
          <span className="font-semibold" style={{ color: '#f5c518' }}>
            {earnedScore}G
            <span className="font-normal" style={{ color: 'var(--theme-text-muted)' }}> / {totalScore}G</span>
          </span>
        </div>
        {/* Progress bar */}
        <div
          className="w-full rounded-full h-1.5"
          style={{ backgroundColor: 'var(--theme-border)' }}
        >
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${progressPct}%`, backgroundColor: 'var(--theme-accent)' }}
          />
        </div>
      </div>

      {/* Achievement list */}
      <div className="space-y-2">
        {achievements.map(a => (
          <div
            key={a.id}
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{
              backgroundColor: 'var(--theme-item-default)',
              opacity: a.unlocked ? 1 : 0.6,
            }}
          >
            {/* Icon */}
            <div className="shrink-0 w-10 h-10 flex items-center justify-center overflow-hidden">
              {a.iconDataUrl ? (
                <img src={a.iconDataUrl} alt="" className="w-10 h-10 object-cover" />
              ) : a.unlocked ? (
                <Trophy className="w-5 h-5" style={{ color: '#f5c518' }} />
              ) : (
                <Lock className="w-5 h-5" style={{ color: 'var(--theme-text-muted)' }} />
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
                {a.label}
              </p>
              <p className="text-xs break-words" style={{ color: 'var(--theme-text-muted)' }}>
                {a.unlocked ? a.description : a.unachievedDescription}
              </p>
            </div>

            {/* Gamerscore badge */}
            <span
              className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: a.unlocked ? '#f5c518' : 'var(--theme-item-selected)',
                color: a.unlocked ? '#1a1a1a' : 'var(--theme-text-muted)',
              }}
            >
              {a.gamerscore}G
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
