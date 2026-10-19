import { useSyncExternalStore } from 'react';

// Breakpoints match Tailwind's (sm 640, md 768, lg 1024) so inline-styled screens
// switch layout at the same widths as Tailwind ones.
export const bp = { sm: 640, md: 768, lg: 1024 };

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// Phones: narrower than Tailwind's `md`.
export const useIsPhone = () => useMediaQuery(`(max-width: ${bp.md - 1}px)`);
