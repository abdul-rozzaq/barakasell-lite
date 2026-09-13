import { useEffect, useState } from 'react';

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}

export function OfflinePill({ pendingCount }: { pendingCount: number }) {
  const online = useOnline();
  if (online) return null;
  return (
    <span className="font-condensed text-xs font-semibold px-2 py-1 bg-warning-bg text-warning-text border border-warning-border whitespace-nowrap">
      OFFLINE · {pendingCount} ta yuborilmadi
    </span>
  );
}
