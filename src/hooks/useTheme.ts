import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { applyTheme } from '@/lib/applyTheme';
import { FINAL_STAGE_THEME, sanitizeTheme, type ThemeConfig } from '@/lib/theme';

type ThemeResponse = Partial<Record<string, unknown>>;

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeConfig>(FINAL_STAGE_THEME);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const remote = await api.get<ThemeResponse>('/theme');
        if (cancelled) return;
        const nextTheme = sanitizeTheme(remote);
        setThemeState(nextTheme);
        applyTheme(nextTheme);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load theme';
        setError(message);
        applyTheme(FINAL_STAGE_THEME);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(async (next: ThemeConfig) => {
    const normalized = sanitizeTheme(next);
    setIsSaving(true);
    setError(null);
    try {
      const saved = await api.put<ThemeResponse>('/admin/theme', normalized);
      const merged = sanitizeTheme(saved);
      setThemeState(merged);
      applyTheme(merged);
      return merged;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save theme';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const resetTheme = useCallback(() => {
    setThemeState(FINAL_STAGE_THEME);
    applyTheme(FINAL_STAGE_THEME);
  }, []);

  return useMemo(
    () => ({ theme, isLoading, isSaving, error, setTheme, resetTheme }),
    [theme, isLoading, isSaving, error, setTheme, resetTheme],
  );
}
