import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeName =
  | 'steam'
  | 'blades'
  | 'peace'
  | 'aqua'
  | 'xmb'
  | 'wii'
  | 'embers'
  | 'gothic'
  | 'space'
  | 'sunny'
  | 'toy'
  | 'matrix';

interface ThemeColors {
  pageBg: string;
  sidebarBg: string;
  topbarBg: string;
  cardBg: string;
  border: string;
  itemSelected: string;
  itemHover: string;
  itemDefault: string;
  accent: string;
  accentHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  gradientFrom: string;
  gradientTo: string;
  backdropBlur: string;
    headerTint: string;
    headerColor: string;
    progressFg: string;
    progressBg: string;
    tagBg: string;
    tagFg: string;
    sectionOverlay: string;
    coverOverlayColor: string;
}

const themes: Record<ThemeName, ThemeColors> = {
  steam: {
    pageBg: '#1b2838',
    sidebarBg: '#171a21',
    topbarBg: '#171a21',
    cardBg: '#0e1419',
    border: '#2a3f5f',
    itemSelected: '#2a475e',
    itemHover: '#212832',
    itemDefault: 'transparent',
    accent: '#417cff',
    accentHover: '#5a93ff',
    textPrimary: '#ffffff',
    textSecondary: '#c7d5e0',
    textMuted: '#8f98a0',
    inputBg: '#0e1419',
    gradientFrom: '#417cff',
    gradientTo: '#5c7e10',
    backdropBlur: 'none',
      headerTint: 'rgba(0, 0, 0, 0)',
      headerColor: 'rgba(255, 255, 255, 1)',
      progressFg: '#417cff', // accent
      progressBg: '#212832',
      tagBg: '#2a475e',
      tagFg: '#a8c8ff',
      sectionOverlay: 'rgba(14, 20, 31, 0.88)',
      coverOverlayColor: 'rgba(0, 0, 0, 0.78)',
  },
  peace: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(200, 100, 255, 0.07)',
    topbarBg: 'rgba(255, 120, 200, 0.08)',
    cardBg: 'rgba(255, 180, 255, 0.10)',
    border: 'rgba(255, 180, 255, 0.35)',
    itemSelected: 'rgba(255, 100, 220, 0.25)',
    itemHover: 'rgba(255, 160, 255, 0.12)',
    itemDefault: 'rgba(255, 200, 255, 0.05)',
    accent: '#ff6eb4',
    accentHover: '#ff8fca',
    textPrimary: '#fff5ff',
    textSecondary: '#ffd0f5',
    textMuted: '#cc99cc',
    inputBg: 'rgba(255, 120, 200, 0.07)',
    gradientFrom: '#ff6eb4',
    gradientTo: '#ffaa00',
    backdropBlur: 'none',
      headerTint: 'rgba(0, 0, 0, 0)',
      headerColor: 'rgba(255, 255, 255, 1)',
      progressFg: '#ff6eb4', // accent
      progressBg: 'rgba(255, 120, 200, 0.15)',
      tagBg: '#7a1c5a',
      tagFg: '#ffd0f0',
      sectionOverlay: 'rgba(30, 0, 25, 0.72)',
      coverOverlayColor: 'rgba(15, 0, 12, 0.75)',
  },
  blades: {
    pageBg: 'rgba(255, 255, 255, 0)',
    sidebarBg: 'rgba(255, 255, 255, 0.07)',
    topbarBg: 'rgba(255, 255, 255, 0.08)',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.4)',
    itemSelected: 'rgba(255, 255, 255, 0.29)',
    itemHover: 'rgba(255, 255, 255, 0.10)',
    itemDefault: 'rgba(255, 255, 255, 0.05)',
    accent: '#4ca64c',
    accentHover: '#5cbf5c',
    textPrimary: '#f0f5f0',
    textSecondary: '#c8d8c8',
    textMuted: '#8aaa8a',
    inputBg: 'rgba(255, 255, 255, 0.06)',
    gradientFrom: '#4ca64c',
    gradientTo: '#2a7a2a',
    backdropBlur: 'none',
      headerTint: 'rgba(0, 0, 0, 0)',
      headerColor: 'rgba(255, 255, 255, 1)',
      progressFg: '#4ca64c', // accent
      progressBg: 'rgba(255,255,255,0.18)',
      tagBg: '#2a5a2a',
      tagFg: '#c8f0c8',
      sectionOverlay: 'rgba(0, 8, 0, 0.75)',
      coverOverlayColor: 'rgba(0, 0, 0, 0.75)',
  },
  aqua: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(0, 180, 220, 0.10)',
    topbarBg: 'rgba(0, 160, 210, 0.12)',
    cardBg: 'rgba(0, 200, 240, 0.10)',
    border: 'rgba(100, 230, 255, 0.35)',
    itemSelected: 'rgba(0, 200, 255, 0.25)',
    itemHover: 'rgba(80, 210, 255, 0.14)',
    itemDefault: 'rgba(0, 180, 220, 0.06)',
    accent: '#00d4ff',
    accentHover: '#33ddff',
    textPrimary: '#e8faff',
    textSecondary: '#b0eaff',
    textMuted: '#6ec8e8',
    inputBg: 'rgba(0, 160, 210, 0.10)',
    gradientFrom: '#00d4ff',
    gradientTo: '#0066aa',
    backdropBlur: 'none',
      headerTint: 'rgba(0, 0, 0, 0)',
      headerColor: 'rgba(255, 255, 255, 1)',
      progressFg: '#00d4ff', // accent
      progressBg: 'rgba(0, 180, 220, 0.18)',
      tagBg: '#053b4f',
      tagFg: '#9eecff',
      sectionOverlay: 'rgba(0, 15, 25, 0.75)',
      coverOverlayColor: 'rgba(0, 5, 15, 0.75)',
  },
  xmb: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(180, 10, 10, 0.10)',
    topbarBg: 'rgba(180, 10, 10, 0.12)',
    cardBg: 'rgba(200, 20, 20, 0.08)',
    border: 'rgba(255, 60, 60, 0.28)',
    itemSelected: 'rgba(220, 30, 30, 0.28)',
    itemHover: 'rgba(200, 40, 40, 0.16)',
    itemDefault: 'rgba(180, 20, 20, 0.05)',
    accent: '#cc0000',
    accentHover: '#e02020',
    textPrimary: '#ffffff',
    textSecondary: '#ffcccc',
    textMuted: '#cc8888',
    inputBg: 'rgba(180, 10, 10, 0.10)',
    gradientFrom: '#cc0000',
    gradientTo: '#660000',
    backdropBlur: 'none',
      headerTint: 'rgba(102, 0, 0, 0.0)',
      headerColor: 'rgba(255, 0, 0, 0.0)',
      progressFg: '#ffffff', // accent
      progressBg: 'rgba(180, 20, 20, 0)',
      tagBg: '#5a0808',
      tagFg: '#ffd0d0',
      sectionOverlay: 'rgba(15, 0, 0, 0.78)',
      coverOverlayColor: 'rgba(10, 0, 0, 0.75)',
  },
  gothic: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(8, 12, 26, 0.70)',
    topbarBg: 'rgba(6, 10, 22, 0.78)',
    cardBg: 'rgba(14, 20, 40, 0.55)',
    border: 'rgba(80, 110, 200, 0.40)',
    itemSelected: 'rgba(60, 90, 200, 0.35)',
    itemHover: 'rgba(40, 60, 140, 0.22)',
    itemDefault: 'rgba(15, 20, 40, 0.35)',
    accent: '#5a78e0',
    accentHover: '#7c97ff',
    textPrimary: '#e6ecff',
    textSecondary: '#a8b5d6',
    textMuted: '#6072a0',
    inputBg: 'rgba(8, 12, 26, 0.65)',
    gradientFrom: '#1a2a5a',
    gradientTo: '#05070f',
    backdropBlur: 'none',
    headerTint: 'rgba(10, 15, 35, 0.0)',
    headerColor: 'rgba(255, 255, 255, 0.0)',
    progressFg: '#5a78e0',
    progressBg: 'rgba(20, 30, 60, 0.55)',
    tagBg: '#0e1633',
    tagFg: '#aac0ff',
    sectionOverlay: 'rgba(6, 10, 22, 0.85)',
    coverOverlayColor: 'rgba(0, 0, 0, 0.78)',
  },
  embers: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(20, 0, 0, 0.65)',
    topbarBg: 'rgba(15, 0, 0, 0.75)',
    cardBg: 'rgba(30, 5, 5, 0.55)',
    border: 'rgba(180, 20, 20, 0.45)',
    itemSelected: 'rgba(180, 0, 0, 0.35)',
    itemHover: 'rgba(120, 0, 0, 0.20)',
    itemDefault: 'rgba(40, 0, 0, 0.30)',
    accent: '#b00020',
    accentHover: '#e0102a',
    textPrimary: '#f5e6e6',
    textSecondary: '#d49a9a',
    textMuted: '#8a5050',
    inputBg: 'rgba(20, 0, 0, 0.65)',
    gradientFrom: '#b00020',
    gradientTo: '#1a0000',
    backdropBlur: 'none',
    headerTint: 'rgba(40, 0, 0, 0.35)',
    headerColor: 'rgba(255, 220, 220, 0.95)',
    progressFg: '#b00020',
    progressBg: 'rgba(60, 0, 0, 0.45)',
    tagBg: '#3a0000',
    tagFg: '#ffb0b0',
    sectionOverlay: 'rgba(12, 0, 0, 0.85)',
    coverOverlayColor: 'rgba(5, 0, 0, 0.78)',
  },
  space: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(8, 6, 28, 0.72)',
    topbarBg: 'rgba(6, 4, 22, 0.78)',
    cardBg: 'rgba(20, 12, 50, 0.55)',
    border: 'rgba(140, 110, 240, 0.40)',
    itemSelected: 'rgba(120, 80, 240, 0.32)',
    itemHover: 'rgba(80, 60, 180, 0.22)',
    itemDefault: 'rgba(20, 12, 50, 0.30)',
    accent: '#9b6dff',
    accentHover: '#b58bff',
    textPrimary: '#efeaff',
    textSecondary: '#bfb0e6',
    textMuted: '#7a6fa8',
    inputBg: 'rgba(8, 6, 28, 0.65)',
    gradientFrom: '#9b6dff',
    gradientTo: '#1a0a3a',
    backdropBlur: 'none',
    headerTint: 'rgba(0, 0, 0, 0)',
    headerColor: 'rgba(255, 255, 255, 0)',
    progressFg: '#9b6dff',
    progressBg: 'rgba(40, 20, 90, 0.55)',
    tagBg: '#1a0e3d',
    tagFg: '#cdb8ff',
    sectionOverlay: 'rgba(5, 4, 20, 0.85)',
    coverOverlayColor: 'rgba(0, 0, 0, 0.78)',
  },
  sunny: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(255, 245, 220, 0.65)',
    topbarBg: 'rgba(255, 240, 200, 0.78)',
    cardBg: 'rgba(255, 250, 230, 0.85)',
    border: 'rgba(220, 170, 80, 0.45)',
    itemSelected: 'rgba(255, 190, 80, 0.30)',
    itemHover: 'rgba(255, 210, 120, 0.22)',
    itemDefault: 'rgba(255, 235, 180, 0.20)',
    accent: '#f59e0b',
    accentHover: '#fbbf24',
    textPrimary: '#3a2a10',
    textSecondary: '#7a5a20',
    textMuted: '#a88a55',
    inputBg: 'rgba(255, 250, 230, 0.85)',
    gradientFrom: '#fde68a',
    gradientTo: '#fbbf24',
    backdropBlur: 'none',
    headerTint: 'rgba(0, 0, 0, 0)',
    headerColor: 'rgba(255, 255, 255, 1)',
    progressFg: '#f59e0b',
    progressBg: 'rgba(255, 200, 100, 0.30)',
    tagBg: '#fde68a',
    tagFg: '#7a4d05',
    sectionOverlay: 'rgba(255, 245, 200, 0.85)',
    coverOverlayColor: 'rgba(30, 20, 0, 0.62)',
  },
  toy: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(255, 255, 255, 0.78)',
    topbarBg: 'rgba(255, 255, 255, 0.85)',
    cardBg: 'rgba(255, 255, 255, 0.92)',
    border: 'rgba(255, 100, 150, 0.45)',
    itemSelected: 'rgba(255, 120, 180, 0.25)',
    itemHover: 'rgba(120, 200, 255, 0.20)',
    itemDefault: 'rgba(255, 255, 255, 0.30)',
    accent: '#ff5aa0',
    accentHover: '#ff7ab8',
    textPrimary: '#2a1530',
    textSecondary: '#5a3a6a',
    textMuted: '#9080a0',
    inputBg: 'rgba(255, 255, 255, 0.85)',
    gradientFrom: '#ff5aa0',
    gradientTo: '#5acaff',
    backdropBlur: 'none',
    headerTint: 'rgba(0, 0, 0, 0)',
    headerColor: 'rgba(255, 255, 255, 1)',
    progressFg: '#ff5aa0',
    progressBg: 'rgba(255, 200, 220, 0.40)',
    tagBg: '#ffd6e8',
    tagFg: '#a02060',
    sectionOverlay: 'rgba(255, 255, 255, 0.85)',
    coverOverlayColor: 'rgba(20, 0, 15, 0.62)',
  },
  matrix: {
    pageBg: 'rgba(0, 0, 0, 0)',
    sidebarBg: 'rgba(0, 12, 4, 0.78)',
    topbarBg: 'rgba(0, 10, 4, 0.85)',
    cardBg: 'rgba(0, 20, 8, 0.65)',
    border: 'rgba(0, 200, 80, 0.45)',
    itemSelected: 'rgba(0, 200, 80, 0.28)',
    itemHover: 'rgba(0, 160, 60, 0.18)',
    itemDefault: 'rgba(0, 20, 8, 0.45)',
    accent: '#00ff66',
    accentHover: '#5cff95',
    textPrimary: '#c8ffd6',
    textSecondary: '#7adf95',
    textMuted: '#3a8a55',
    inputBg: 'rgba(0, 12, 4, 0.75)',
    gradientFrom: '#00ff66',
    gradientTo: '#001a08',
    backdropBlur: 'none',
    headerTint: 'rgba(0, 30, 10, 0.40)',
    headerColor: 'rgba(180, 255, 200, 0.95)',
    progressFg: '#00ff66',
    progressBg: 'rgba(0, 40, 15, 0.55)',
    tagBg: '#022810',
    tagFg: '#7cff9c',
    sectionOverlay: 'rgba(0, 8, 4, 0.88)',
    coverOverlayColor: 'rgba(0, 5, 2, 0.80)',
  },
  wii: {
    pageBg: '#e6f2fb',
    sidebarBg: 'rgba(255,255,255,0.60)',
    topbarBg: 'rgba(255,255,255,0.80)',
    cardBg: 'rgba(255,255,255,0.95)',
    border: 'rgba(180, 200, 220, 0.40)',
    itemSelected: 'rgba(0, 180, 255, 0.18)',
    itemHover: 'rgba(0, 180, 255, 0.10)',
    itemDefault: 'rgba(255,255,255,0.05)',
    accent: '#00b9f3',
    accentHover: '#00d4ff',
    textPrimary: '#2a2a2a',
    textSecondary: '#4a6fa5',
    textMuted: '#8bb3d9',
    inputBg: 'rgba(255,255,255,0.85)',
    gradientFrom: '#b3e6ff',
    gradientTo: '#e6f2fb',
    backdropBlur: 'none',
    headerTint: 'rgba(0, 185, 243, 0.10)',
    headerColor: 'rgba(255,255,255,0.95)',
    progressFg: '#00b9f3',
    progressBg: 'rgba(0, 185, 243, 0.10)',
    tagBg: '#cfeeff',
    tagFg: '#0a4a6f',
    sectionOverlay: 'rgba(220, 238, 250, 0.90)',
    coverOverlayColor: 'rgba(0, 10, 20, 0.65)',
  },
};

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    try {
      const stored = localStorage.getItem('rex_theme') as ThemeName | null;
      if (stored && stored in themes) return stored;
      return 'steam';
    } catch {
      return 'steam';
    }
  });

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem('rex_theme', t);
  };

  useEffect(() => {
    const colors = themes[theme] ?? themes.steam;
    const root = document.documentElement;
    root.style.setProperty('--background', colors.pageBg);
    root.style.setProperty('--theme-page-bg', colors.pageBg);
    root.style.setProperty('--theme-sidebar-bg', colors.sidebarBg);
    root.style.setProperty('--theme-card-bg', colors.cardBg);
    root.style.setProperty('--theme-border', colors.border);
    root.style.setProperty('--theme-item-selected', colors.itemSelected);
    root.style.setProperty('--theme-item-hover', colors.itemHover);
    root.style.setProperty('--theme-item-default', colors.itemDefault);
    root.style.setProperty('--theme-accent', colors.accent);
    root.style.setProperty('--theme-accent-hover', colors.accentHover);
    root.style.setProperty('--theme-text-primary', colors.textPrimary);
    root.style.setProperty('--theme-text-secondary', colors.textSecondary);
    root.style.setProperty('--theme-text-muted', colors.textMuted);
    root.style.setProperty('--theme-input-bg', colors.inputBg);
    root.style.setProperty('--theme-gradient-from', colors.gradientFrom);
    root.style.setProperty('--theme-gradient-to', colors.gradientTo);
    root.style.setProperty('--theme-backdrop-blur', colors.backdropBlur);
    root.style.setProperty('--theme-topbar-bg', colors.topbarBg);

    // Header color (rgba controlling the image texture color and visibility)
    root.style.setProperty('--theme-header-color', colors.headerColor);
    const alphaMatch = colors.headerColor.match(/[\d.]+(?=\s*\)$)/);
    root.style.setProperty('--theme-header-alpha', alphaMatch ? alphaMatch[0] : '1');
    // Header tint overlay (rgba painted over the image)
    root.style.setProperty('--theme-header-overlay', colors.headerTint);
      // Progress bar colors
      root.style.setProperty('--theme-progress-fg', colors.progressFg);
      root.style.setProperty('--theme-progress-bg', colors.progressBg);
      // Tag (always opaque)
      root.style.setProperty('--theme-tag-bg', colors.tagBg);
      root.style.setProperty('--theme-tag-fg', colors.tagFg);
      // Section overlay + cover art overlay
      root.style.setProperty('--theme-section-overlay', colors.sectionOverlay);
      root.style.setProperty('--theme-cover-overlay', colors.coverOverlayColor);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors: themes[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
