import { useEffect } from 'react';

type PageRefreshOptions = {
  disabled?: boolean;
  intervalMs?: number;
};

export function usePageRefresh(
  refresh: () => void | Promise<void>,
  { disabled = false, intervalMs }: PageRefreshOptions = {},
) {
  useEffect(() => {
    if (disabled) return undefined;

    const run = () => {
      void refresh();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') run();
    };

    window.addEventListener('focus', run);
    window.addEventListener('pageshow', run);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalID = intervalMs && intervalMs > 0
      ? window.setInterval(run, intervalMs)
      : undefined;

    return () => {
      window.removeEventListener('focus', run);
      window.removeEventListener('pageshow', run);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalID !== undefined) window.clearInterval(intervalID);
    };
  }, [disabled, intervalMs, refresh]);
}
