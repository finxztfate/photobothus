import './SparkleDivider.css';

const SPARKLE_PATH = 'M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z';

function Sparkle({ size }) {
  return (
    <svg className={`sparkle sparkle-${size}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={SPARKLE_PATH} />
    </svg>
  );
}

function SparkleDivider({ className = '' }) {
  return (
    <div className={`sparkle-divider ${className}`.trim()} role="separator">
      <span className="divider-line" />
      <Sparkle size="sm" />
      <Sparkle size="lg" />
      <Sparkle size="sm" />
      <span className="divider-line" />
    </div>
  );
}

export default SparkleDivider;
