export function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12" />
      <path d="m7 12 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function IconPrint() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 8V4h10v4" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M7 13h10v7H7z" />
    </svg>
  );
}

export function IconGallery() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16v13H4z" />
      <path d="M8 7V5h8v2" />
    </svg>
  );
}

export function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 13.2 7.6 4.1" />
      <path d="m15.8 6.7-7.6 4.1" />
    </svg>
  );
}

export function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V5" />
      <path d="m7 10 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function StripPrintSpec({ size, twin = false, className = '' }) {
  return (
    <div className={`edit-print-spec ${className}`.trim()}>
      <span className="edit-print-spec-kicker">Photobooth strip</span>
      <strong className="edit-print-spec-size">{size.label}</strong>
      <span className="edit-print-spec-dpi">{size.dpi} DPI</span>
      {twin ? (
        <span className="edit-print-spec-pair">Print places two copies on one sheet to cut</span>
      ) : null}
    </div>
  );
}
