import { useEffect, useState } from 'react';

type ColorScheme = 'dark' | 'light';

/**
 * Returns the current OS/browser preferred colour scheme and
 * re-renders whenever the user switches between dark and light mode.
 */
export function useColorScheme(): ColorScheme {
  const getScheme = (): ColorScheme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const [scheme, setScheme] = useState<ColorScheme>(getScheme);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setScheme(getScheme());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return scheme;
}
