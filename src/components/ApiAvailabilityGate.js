import { useEffect, useState } from 'react';
import { checkApiHealth } from '../utils/api';
import SystemStatusPage from './SystemStatusPage';

function ApiAvailabilityGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | ok | down

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const probe = async () => {
      attempts += 1;
      try {
        await checkApiHealth();
        if (!cancelled) setStatus('ok');
      } catch {
        if (cancelled) return;
        // Retry once quickly in case the proxy/server is still booting.
        if (attempts < 2) {
          window.setTimeout(probe, 800);
          return;
        }
        if (!cancelled) setStatus('down');
      }
    };

    probe();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'down') {
    return <SystemStatusPage kind="offline" />;
  }

  // Don't block the whole UI on the first paint; only replace when confirmed down.
  return children;
}

export default ApiAvailabilityGate;