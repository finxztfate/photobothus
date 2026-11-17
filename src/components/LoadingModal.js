import { useSyncExternalStore } from 'react';
import { isDataLoading, subscribeDataLoading } from '../utils/loadingBus';
import './LoadingModal.css';

function LoadingModal() {
  const open = useSyncExternalStore(subscribeDataLoading, isDataLoading, () => false);
  if (!open) return null;

  return (
    <div className="data-loading" role="dialog" aria-modal="true" aria-labelledby="data-loading-title">
      <div className="data-loading-card">
        <span className="data-loading-spinner" aria-hidden="true" />
        <p id="data-loading-title">Loading…</p>
      </div>
    </div>
  );
}

export default LoadingModal;
