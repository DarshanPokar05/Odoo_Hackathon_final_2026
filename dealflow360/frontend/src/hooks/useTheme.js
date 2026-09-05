import { useState, useEffect } from 'react';

const STORAGE_KEY = 'dealflow360-theme';

/**
 * useTheme
 * ─────────
 * Manages the dark/light theme toggle.
 * - Defaults to the user's system preference on first load.
 * - Persists explicit choices to localStorage under 'dealflow360-theme'.
 * - Applies 'dark' class to <html> when dark mode is active.
 *
 * Returns: { isDark, toggleTheme }
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'dark';
    // Fall back to OS preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark((d) => !d);

  return { isDark, toggleTheme };
}
