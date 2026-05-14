import { useEffect, useState } from 'react';

// useOnline — track navigator.onLine via 'online' / 'offline' window events.
//
// Why this minimal contract:
//   - heartbeat probes (fetch /healthz every Ns) trade complexity + extra
//     traffic for marginally better detection. PoC-acceptable to lean on
//     navigator.onLine; React Query retry+timeout handles "connected to WiFi
//     but no internet" edge case (see plan §5 D3).
//   - SSR-safe: navigator may be undefined in non-browser env, default to
//     online so the layout doesn't flash an offline banner during SSR.
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
