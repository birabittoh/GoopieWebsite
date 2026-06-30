import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CVar } from '../types/game';

export type CVarValue = number | boolean | string;

const STORAGE_PREFIX = 'goopie:cvars:';

function storageKey(gameId: string): string {
  return `${STORAGE_PREFIX}${gameId}`;
}

function loadStored(gameId: string): Record<string, CVarValue> {
  try {
    const raw = localStorage.getItem(storageKey(gameId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, CVarValue>;
  } catch {
    /* ignore */
  }
  return {};
}

function coerce(cvar: CVar, raw: CVarValue | undefined): CVarValue {
  if (raw === undefined || raw === null) return cvar.defaultValue;
  if (cvar.type === 'Bool') return Boolean(raw);
  if (cvar.type === 'Enum') {
    const opts = cvar.options ?? [];
    const s = String(raw);
    return opts.includes(s) ? s : cvar.defaultValue;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!isFinite(n)) return cvar.defaultValue;
  return cvar.type === 'Int' ? Math.trunc(n) : n;
}

function formatArg(cvar: CVar, value: CVarValue): string {
  if (cvar.type === 'Bool') return Boolean(value) ? 'true' : 'false';
  if (cvar.type === 'Enum') return String(value);
  if (cvar.type === 'Int') return String(Math.trunc(Number(value)));
  // Float — keep finite numeric formatting (avoid trailing exponent).
  const n = Number(value);
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

/**
 * Persists per-game cvar values in localStorage and exposes helpers to
 * read/update them and to build the launch argument string consumed by CEF.
 */
export function useCvarSettings(gameId: string | undefined, cvars: CVar[] | undefined) {
  const list = useMemo(() => cvars ?? [], [cvars]);
  const [values, setValues] = useState<Record<string, CVarValue>>({});

  // Reload whenever the selected game changes.
  useEffect(() => {
    if (!gameId) { setValues({}); return; }
    setValues(loadStored(gameId));
  }, [gameId]);

  const setValue = useCallback((cvarId: string, value: CVarValue) => {
    if (!gameId) return;
    setValues(prev => {
      const next = { ...prev, [cvarId]: value };
      try { localStorage.setItem(storageKey(gameId), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [gameId]);

  const reset = useCallback((cvarId: string) => {
    if (!gameId) return;
    setValues(prev => {
      const next = { ...prev };
      delete next[cvarId];
      try { localStorage.setItem(storageKey(gameId), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [gameId]);

  const getValue = useCallback((cvar: CVar): CVarValue => {
    return coerce(cvar, values[cvar.id]);
  }, [values]);

  const buildArgs = useCallback((): string => {
    const parts: string[] = [];
    for (const cvar of list) {
      const tag = (cvar.tag || '').trim();
      if (!tag) continue;
      const value = coerce(cvar, values[cvar.id]);
      parts.push(`--${tag}=${formatArg(cvar, value)}`);
    }
    return parts.join(' ');
  }, [list, values]);

  return { values, getValue, setValue, reset, buildArgs };
}
