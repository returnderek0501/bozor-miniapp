import { useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('uztronix-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  const tgScheme = window.Telegram?.WebApp?.colorScheme;
  return tgScheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('uztronix-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggle, isDark: theme === 'dark' };
}
