/** Canonical strip layout definitions. */
export const STRIP_LAYOUTS = [
  {
    id: 1,
    slug: 'classic-strip',
    name: 'Classic Strip',
    label: ['Classic', 'Strip'],
    photoCount: 4,
    aspect: '2 / 5',
    areas: '"a" "b" "c" "d" "e"',
    rows: '1fr 1fr 1fr 1fr 0.3fr',
    columns: '1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'photo', photoIndex: 1 },
      { area: 'c', type: 'photo', photoIndex: 2 },
      { area: 'd', type: 'photo', photoIndex: 3 },
      { area: 'e', type: 'dark' },
    ],
    editor: { cols: 1, rows: 4 },
    boothThumb: {
      desktop: { width: 76 },
      mobile: { width: 44 },
    },
  },
  {
    id: 2,
    slug: '4x4-frame',
    name: '4x4 Frame',
    label: ['4x4', 'Frame'],
    photoCount: 4,
    aspect: '2 / 3',
    areas: '"a b" "c d" "e e"',
    rows: '1fr 1fr 0.3fr',
    columns: '1fr 1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'photo', photoIndex: 1 },
      { area: 'c', type: 'photo', photoIndex: 2 },
      { area: 'd', type: 'photo', photoIndex: 3 },
      { area: 'e', type: 'dark' },
    ],
    editor: { cols: 2, rows: 2 },
    boothThumb: {
      desktop: { width: 80 },
      mobile: { width: 48 },
    },
  },
  {
    id: 3,
    slug: 'polaroid',
    name: 'Polaroid',
    label: ['Polaroid'],
    photoCount: 1,
    aspect: '3 / 4',
    areas: '"a" "b"',
    rows: '1fr 0.25fr',
    columns: '1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'dark' },
    ],
    editor: { cols: 1, rows: 1 },
    boothThumb: {
      desktop: { width: 96 },
      mobile: { width: 52 },
    },
  },
  {
    id: 4,
    slug: 'wide-strip',
    name: 'Wide Strip',
    label: ['Wide', 'Strip'],
    photoCount: 2,
    aspect: '3 / 5',
    areas: '"a" "b" "c"',
    rows: '1fr 1fr 0.25fr',
    columns: '1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'photo', photoIndex: 1 },
      { area: 'c', type: 'dark' },
    ],
    editor: { cols: 1, rows: 2 },
    boothThumb: {
      desktop: { width: 80 },
      mobile: { width: 46 },
    },
  },
  {
    id: 5,
    slug: 'wide-landscape',
    name: 'Wide Landscape',
    label: ['Wide', 'Landscape'],
    photoCount: 1,
    aspect: '16 / 10',
    areas: '"a" "b"',
    rows: '1fr 0.15fr',
    columns: '1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'dark' },
    ],
    editor: { cols: 1, rows: 1, landscape: true },
    boothThumb: {
      desktop: { width: 120 },
      mobile: { width: 72 },
    },
  },
  {
    id: 6,
    slug: '4x6-3poses',
    name: 'Size 4x6 3 Poses',
    label: ['Size 4x6', '3 Poses'],
    photoCount: 3,
    aspect: '3 / 2',
    areas: '"a b" "c d"',
    rows: '1fr 1fr',
    columns: '1fr 1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'dark' },
      { area: 'c', type: 'photo', photoIndex: 1 },
      { area: 'd', type: 'photo', photoIndex: 2 },
    ],
    editor: { cols: 2, rows: 2, landscape: true, skipCells: [{ row: 0, col: 1 }] },
    boothThumb: {
      desktop: { width: 96 },
      mobile: { width: 60 },
    },
  },
  {
    id: 7,
    slug: '4x6-4poses',
    name: 'Size 4x6 4 Poses',
    label: ['Size 4x6', '4 Poses'],
    photoCount: 4,
    aspect: '16 / 10',
    areas: '"a a b" "c d e"',
    rows: '1fr 1fr',
    columns: '1.4fr 1fr 1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'dark' },
      { area: 'c', type: 'photo', photoIndex: 1 },
      { area: 'd', type: 'photo', photoIndex: 2 },
      { area: 'e', type: 'photo', photoIndex: 3 },
    ],
    editor: { cols: 3, rows: 2, landscape: true, skipCells: [{ row: 0, col: 2 }] },
    boothThumb: {
      desktop: { width: 100 },
      mobile: { width: 64 },
    },
  },
  {
    id: 8,
    slug: 'triple-strip',
    name: 'Triple Strip',
    label: ['Triple', 'Strip'],
    photoCount: 3,
    aspect: '1 / 2',
    areas: '"a" "b" "c" "d"',
    rows: '1fr 1fr 1fr 0.3fr',
    columns: '1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'photo', photoIndex: 1 },
      { area: 'c', type: 'photo', photoIndex: 2 },
      { area: 'd', type: 'dark' },
    ],
    editor: { cols: 1, rows: 3 },
    boothThumb: {
      desktop: { width: 78 },
      mobile: { width: 46 },
    },
  },
  {
    id: 9,
    slug: '6-photo-grid',
    name: '6-Photo Grid',
    label: ['6-Photo', 'Grid'],
    photoCount: 6,
    aspect: '3 / 5',
    areas: '"a b" "c d" "e f" "g g"',
    rows: '1fr 1fr 1fr 0.3fr',
    columns: '1fr 1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'photo', photoIndex: 1 },
      { area: 'c', type: 'photo', photoIndex: 2 },
      { area: 'd', type: 'photo', photoIndex: 3 },
      { area: 'e', type: 'photo', photoIndex: 4 },
      { area: 'f', type: 'photo', photoIndex: 5 },
      { area: 'g', type: 'dark' },
    ],
    editor: { cols: 2, rows: 3 },
    boothThumb: {
      desktop: { width: 70 },
      mobile: { width: 40 },
    },
  },
  {
    id: 10,
    slug: 'film-strip',
    name: 'Film Strip',
    label: ['Film', 'Strip'],
    photoCount: 4,
    aspect: '16 / 5',
    areas: '"a b c d" "e e e e"',
    rows: '1fr 0.25fr',
    columns: '1fr 1fr 1fr 1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'photo', photoIndex: 1 },
      { area: 'c', type: 'photo', photoIndex: 2 },
      { area: 'd', type: 'photo', photoIndex: 3 },
      { area: 'e', type: 'dark' },
    ],
    editor: { cols: 4, rows: 1, landscape: true },
    boothThumb: {
      desktop: { width: 80 },
      mobile: { width: 48 },
    },
  },
  {
    id: 11,
    slug: 'feature-frame',
    name: 'Feature Frame',
    label: ['Feature', 'Frame'],
    photoCount: 3,
    aspect: '3 / 4',
    areas: '"a a" "b c" "d d"',
    rows: '1.3fr 1fr 0.28fr',
    columns: '1fr 1fr',
    cells: [
      { area: 'a', type: 'photo', photoIndex: 0 },
      { area: 'b', type: 'photo', photoIndex: 1 },
      { area: 'c', type: 'photo', photoIndex: 2 },
      { area: 'd', type: 'dark' },
    ],
    editor: { cols: 2, rows: 2 },
    boothThumb: {
      desktop: { width: 84 },
      mobile: { width: 50 },
    },
  },
];

export function getLayoutById(idOrSlug) {
  if (idOrSlug == null) return STRIP_LAYOUTS[0];
  const numeric = Number(idOrSlug);
  if (!Number.isNaN(numeric)) {
    return STRIP_LAYOUTS.find((l) => l.id === numeric) || STRIP_LAYOUTS[0];
  }
  return STRIP_LAYOUTS.find((l) => l.slug === idOrSlug) || STRIP_LAYOUTS[0];
}

export function resolveLayoutId(param) {
  const layout = getLayoutById(param);
  return layout.id;
}

export function getLayoutPhotoCount(idOrSlug) {
  return getLayoutById(idOrSlug).photoCount;
}

export function getLayoutCssClass(idOrSlug) {
  return getLayoutById(idOrSlug).slug;
}

function parseTracks(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .map((token) => parseFloat(token.replace('fr', '')) || 1);
}

function parseAreaGrid(areasStr) {
  return String(areasStr)
    .trim()
    .split('"')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((row) => row.split(/\s+/));
}

function getAreaSpans(areaGrid) {
  const spans = {};
  areaGrid.forEach((row, rowIndex) => {
    row.forEach((name, colIndex) => {
      if (!spans[name]) {
        spans[name] = { r0: rowIndex, c0: colIndex, r1: rowIndex, c1: colIndex };
      } else {
        spans[name].r0 = Math.min(spans[name].r0, rowIndex);
        spans[name].c0 = Math.min(spans[name].c0, colIndex);
        spans[name].r1 = Math.max(spans[name].r1, rowIndex);
        spans[name].c1 = Math.max(spans[name].c1, colIndex);
      }
    });
  });
  return spans;
}

export const STRIP_PADDING = {
  top: 6,
  side: 6,
  bottom: 18,
};

export function getLayoutCellRects(layoutId, stripWidth, stripHeight, options = {}) {
  const layout = getLayoutById(layoutId);
  const paddingTop = options.paddingTop ?? options.padding ?? STRIP_PADDING.top;
  const paddingRight = options.paddingRight ?? options.padding ?? STRIP_PADDING.side;
  const paddingBottom = options.paddingBottom ?? options.padding ?? STRIP_PADDING.bottom;
  const paddingLeft = options.paddingLeft ?? options.padding ?? STRIP_PADDING.side;
  const logoReserve = options.logoReserve ?? 0;
  const gap = options.gap ?? 2;
  const gridW = stripWidth - paddingLeft - paddingRight;
  const gridH = stripHeight - paddingTop - paddingBottom - logoReserve;

  const rowTracks = parseTracks(layout.rows);
  const colTracks = parseTracks(layout.columns);
  const areaGrid = parseAreaGrid(layout.areas);
  const spans = getAreaSpans(areaGrid);

  const rowGap = gap * Math.max(0, rowTracks.length - 1);
  const colGap = gap * Math.max(0, colTracks.length - 1);
  const rowSum = rowTracks.reduce((sum, value) => sum + value, 0);
  const colSum = colTracks.reduce((sum, value) => sum + value, 0);

  const rowHeights = rowTracks.map((fr) => (fr / rowSum) * (gridH - rowGap));
  const colWidths = colTracks.map((fr) => (fr / colSum) * (gridW - colGap));

  const rowOffsets = [];
  let y = paddingTop;
  rowHeights.forEach((height, index) => {
    rowOffsets.push(y);
    y += height + (index < rowHeights.length - 1 ? gap : 0);
  });

  const colOffsets = [];
  let x = paddingLeft;
  colWidths.forEach((width, index) => {
    colOffsets.push(x);
    x += width + (index < colWidths.length - 1 ? gap : 0);
  });

  return layout.cells.map((cell) => {
    const span = spans[cell.area];
    const x0 = colOffsets[span.c0];
    const y0 = rowOffsets[span.r0];
    const x1 = colOffsets[span.c1] + colWidths[span.c1];
    const y1 = rowOffsets[span.r1] + rowHeights[span.r1];
    return {
      ...cell,
      x: x0,
      y: y0,
      w: x1 - x0,
      h: y1 - y0,
    };
  });
}

export function computeStripDimensions(layoutId) {
  const layout = getLayoutById(layoutId);
  const [aspectW, aspectH] = layout.aspect.split('/').map((value) => parseFloat(value.trim()));
  const stripWidth = aspectW >= aspectH ? 1000 : 520;
  const stripHeight = Math.round(stripWidth * (aspectH / aspectW));

  return {
    padding: STRIP_PADDING,
    stripWidth,
    stripHeight,
    layout,
  };
}

/** Uniform booth capture frame — matches photobooth-io (4:3 preview + thumbs). */
export const BOOTH_CAPTURE_ASPECT = 4 / 3;

export function getBoothCaptureAspect() {
  return BOOTH_CAPTURE_ASPECT;
}

/** Aspect ratio (width / height) of a photo slot — matches strip compositor crop. */
export function getLayoutPhotoSlotAspect(layoutId, photoIndex = 0) {
  const { stripWidth, stripHeight, padding } = computeStripDimensions(layoutId);
  const placements = getPhotoPlacements(layoutId, stripWidth, stripHeight, {
    paddingTop: padding.top,
    paddingRight: padding.side,
    paddingBottom: padding.bottom,
    paddingLeft: padding.side,
    gap: 2,
  });
  if (!placements.length) return 4 / 3;
  const placement = placements[photoIndex] ?? placements[placements.length - 1];
  return placement.w / placement.h;
}

/** Fit width/height inside a box preserving aspect (same logic as the camera preview). */
export function fitAspectInBox(aspect, boxW, boxH) {
  if (!aspect || !boxW || !boxH) return null;

  let width;
  let height;
  if (boxW / boxH >= aspect) {
    height = boxH;
    width = height * aspect;
  } else {
    width = boxW;
    height = width / aspect;
  }

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    aspect,
  };
}

/** Compact 16:9 side thumbs — stay small so the landscape camera can use the width. */
export function computeAlignedSideThumbSlots(captureW, captureH, layoutId, gap = 8, aspect) {
  const slotCount = getLayoutPhotoCount(layoutId);
  if (!captureW || !captureH || slotCount < 1) return null;

  const slotAspect = aspect ?? getBoothCaptureAspect();
  const maxThumbWidth = Math.min(168, Math.max(96, Math.round(captureW * 0.18)));
  const maxStackHeight = Math.max(1, captureH - gap * Math.max(0, slotCount - 1));
  const heightFromWidth = maxThumbWidth / slotAspect;
  const thumbHeight = Math.min(heightFromWidth, maxStackHeight / slotCount);
  const thumbWidth = thumbHeight * slotAspect;

  return Array.from({ length: slotCount }, () => ({
    width: Math.max(72, Math.round(thumbWidth)),
    height: Math.max(40, Math.round(thumbHeight)),
    aspect: slotAspect,
  }));
}

/** Row thumbs scaled to the live capture preview width. */
export function computeAlignedRowThumbSlots(captureW, captureH, layoutId, gap = 8, aspect) {
  const slotCount = getLayoutPhotoCount(layoutId);
  if (!captureW || !captureH || slotCount < 1) return null;

  const slotAspect = aspect ?? getBoothCaptureAspect();
  const slots = Array.from({ length: slotCount }, () => fitAspectInBox(slotAspect, captureW, captureH)).filter(Boolean);

  if (!slots.length) return null;

  const totalW = slots.reduce((sum, slot) => sum + slot.width, 0) + gap * (slotCount - 1);
  if (totalW <= captureW) return slots;

  const scale = (captureW - gap * (slotCount - 1)) / slots.reduce((sum, slot) => sum + slot.width, 0);
  return slots.map((slot) => ({
    width: Math.max(40, Math.round(slot.width * scale)),
    height: Math.max(24, Math.round(slot.height * scale)),
    aspect: slot.aspect,
  }));
}

/** Side-column thumb sizes — uniform row height, width per slot aspect, capped to fit beside camera. */
export function computeSideThumbSlots(mainHeight, layoutId, gap = 8, options = {}) {
  const slotCount = getLayoutPhotoCount(layoutId);
  if (!mainHeight || slotCount < 1) return null;

  const maxThumbWidth = options.maxThumbWidth ?? 120;
  let thumbHeight = Math.floor((mainHeight - gap * Math.max(0, slotCount - 1)) / slotCount);
  if (thumbHeight < 24) return null;

  const slots = Array.from({ length: slotCount }, (_, index) => {
    const aspect = getLayoutPhotoSlotAspect(layoutId, index);
    let width = Math.round(thumbHeight * aspect);
    let height = thumbHeight;

    if (width > maxThumbWidth) {
      width = maxThumbWidth;
      height = Math.round(width / aspect);
    }

    return {
      width: Math.max(40, width),
      height: Math.max(24, height),
      aspect,
    };
  });

  const totalHeight = slots.reduce((sum, slot) => sum + slot.height, 0) + gap * Math.max(0, slotCount - 1);
  if (totalHeight > mainHeight) {
    const scale = (mainHeight - gap * Math.max(0, slotCount - 1)) / (totalHeight - gap * Math.max(0, slotCount - 1));
    return slots.map((slot) => ({
      width: Math.max(40, Math.round(slot.width * scale)),
      height: Math.max(24, Math.round(slot.height * scale)),
      aspect: slot.aspect,
    }));
  }

  return slots;
}

/** Row of thumbs below camera — widths split by each slot aspect. */
export function computeRowThumbSlots(containerWidth, layoutId, gap = 8, maxHeight = 80) {
  const slotCount = getLayoutPhotoCount(layoutId);
  if (!containerWidth || slotCount < 1) return null;

  const aspects = Array.from({ length: slotCount }, (_, index) =>
    getLayoutPhotoSlotAspect(layoutId, index)
  );
  const totalGap = gap * Math.max(0, slotCount - 1);
  const aspectSum = aspects.reduce((sum, aspect) => sum + aspect, 0);
  if (!aspectSum) return null;

  let thumbHeight = Math.floor((containerWidth - totalGap) / aspectSum);
  if (thumbHeight > maxHeight) thumbHeight = maxHeight;

  const slots = aspects.map((aspect) => ({
    width: Math.max(40, Math.round(thumbHeight * aspect)),
    height: thumbHeight,
    aspect,
  }));

  const totalWidth = slots.reduce((sum, slot) => sum + slot.width, 0) + totalGap;
  if (totalWidth > containerWidth) {
    const scale = (containerWidth - totalGap) / (totalWidth - totalGap);
    return slots.map((slot) => ({
      width: Math.max(40, Math.round(slot.width * scale)),
      height: Math.max(24, Math.round(slot.height * scale)),
      aspect: slot.aspect,
    }));
  }

  return slots;
}

/** 'side' = camera left, thumbs right; 'row' = camera above thumb row. */
export function getBoothThumbLayoutMode(viewportWidth, viewportHeight) {
  const w = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 768);
  const h = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 1024);

  // Desktop — camera left, thumbs right
  if (w >= 769) return 'side';
  // Phone / tablet landscape — use horizontal space beside the camera
  if (w > h && h < 520) return 'side';
  // Portrait mobile — stack camera above thumbs
  return 'row';
}

/** Row of thumbs below camera on mobile — fit container width, keep capture aspect. */
export function computeRowThumbSize(containerWidth, slotCount, aspect, gap = 8, maxHeight = 80) {
  if (!containerWidth || slotCount < 1 || !aspect) return null;

  const totalGap = gap * Math.max(0, slotCount - 1);
  let thumbWidth = Math.floor((containerWidth - totalGap) / slotCount);
  let thumbHeight = Math.round(thumbWidth / aspect);

  if (thumbHeight > maxHeight) {
    thumbHeight = maxHeight;
    thumbWidth = Math.round(thumbHeight * aspect);
  }

  const totalWidth = thumbWidth * slotCount + totalGap;
  if (totalWidth > containerWidth) {
    thumbWidth = Math.floor((containerWidth - totalGap) / slotCount);
    thumbHeight = Math.round(thumbWidth / aspect);
  }

  if (thumbWidth < 40) return null;

  return { width: thumbWidth, height: thumbHeight };
}

/** Side-column thumb size from live camera stage height (desktop). */
export function computeSideThumbSize(stageHeight, slotCount, aspect, gap = 8) {
  if (!stageHeight || slotCount < 1 || !aspect) return null;

  const thumbHeight = Math.floor((stageHeight - gap * Math.max(0, slotCount - 1)) / slotCount);
  if (thumbHeight < 24) return null;

  return {
    width: Math.max(56, Math.round(thumbHeight * aspect)),
    height: thumbHeight,
  };
}

/** Booth thumb sizes — mobile row below camera; desktop sized from stage via computeSideThumbSize. */
export function getLayoutThumbSize(layoutId) {
  const layout = getLayoutById(layoutId);
  const aspect = getBoothCaptureAspect();
  const thumb = layout.boothThumb || {};
  const mobileCfg = thumb.mobile || {};

  const mobileWidth = mobileCfg.width ?? 52;
  const mobileHeight = mobileCfg.height ?? Math.round(mobileWidth / aspect);

  return {
    width: mobileWidth,
    height: mobileHeight,
    mobileWidth,
    mobileHeight,
    aspect,
  };
}

export function getLayoutThumbWidth(layoutId) {
  return getLayoutThumbSize(layoutId).width;
}

export function getPhotoPlacements(layoutId, stripWidth, stripHeight, options = {}) {
  return getLayoutCellRects(layoutId, stripWidth, stripHeight, options)
    .filter((cell) => cell.type === 'photo')
    .sort((a, b) => (a.photoIndex ?? 0) - (b.photoIndex ?? 0))
    .map(({ x, y, w, h }) => ({ x, y, w, h }));
}

export function getDarkPlacements(layoutId, stripWidth, stripHeight, options = {}) {
  return getLayoutCellRects(layoutId, stripWidth, stripHeight, options)
    .filter((cell) => cell.type === 'dark')
    .map(({ x, y, w, h }) => ({ x, y, w, h }));
}

/** @deprecated use STRIP_LAYOUTS */
export const layouts = STRIP_LAYOUTS.map((layout) => ({
  id: layout.id,
  name: layout.name,
  slug: layout.slug,
  type: layout.slug,
  photoCount: layout.photoCount,
  label: layout.label,
  aspect: layout.aspect,
  areas: layout.areas,
  rows: layout.rows,
  columns: layout.columns,
  cells: layout.cells,
}));
