const MONO_FONT = '"Courier Prime", "Courier New", monospace';
const VHS_FONT = '"VT323", "Courier Prime", monospace';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function seededRandom(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function vignette(ctx, { x, y, w, h }, color, innerRatio = 0.5) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outer = Math.hypot(w, h) / 2;
  const gradient = ctx.createRadialGradient(cx, cy, outer * innerRatio, cx, cy, outer);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
}

function deckledRectPath(ctx, { x, y, w, h }, amplitude, step, rand) {
  const jitter = () => (rand() - 0.5) * amplitude * 2;
  ctx.moveTo(x, y);
  for (let px = x + step; px < x + w; px += step) ctx.lineTo(px, y + jitter());
  ctx.lineTo(x + w, y);
  for (let py = y + step; py < y + h; py += step) ctx.lineTo(x + w + jitter(), py);
  ctx.lineTo(x + w, y + h);
  for (let px = x + w - step; px > x; px -= step) ctx.lineTo(px, y + h + jitter());
  ctx.lineTo(x, y + h);
  for (let py = y + h - step; py > y; py -= step) ctx.lineTo(x + jitter(), py);
  ctx.closePath();
}

const SEGMENTS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc',
  5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

function drawSevenSegmentText(ctx, text, right, bottom, height, color) {
  const digitW = height * 0.55;
  const thick = height * 0.13;
  const spacing = height * 0.2;
  const shrink = thick * 0.18;
  const widthOf = (ch) => {
    if (ch === ' ') return digitW * 0.6;
    if (ch === "'") return thick + spacing;
    return digitW + spacing;
  };
  const total = [...text].reduce((sum, ch) => sum + widthOf(ch), 0) - spacing;

  ctx.save();
  ctx.translate(right - total, bottom - height);
  ctx.transform(1, 0, -0.1, 1, height * 0.1, 0);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = height * 0.4;

  let ox = 0;
  [...text].forEach((ch) => {
    if (ch === "'") {
      ctx.fillRect(ox, 0, thick, height * 0.3);
    } else if (SEGMENTS[ch]) {
      const half = height / 2;
      const rects = {
        a: [ox + thick / 2, 0, digitW - thick, thick],
        g: [ox + thick / 2, half - thick / 2, digitW - thick, thick],
        d: [ox + thick / 2, height - thick, digitW - thick, thick],
        f: [ox, thick / 2, thick, half - thick / 2],
        b: [ox + digitW - thick, thick / 2, thick, half - thick / 2],
        e: [ox, half, thick, half - thick / 2],
        c: [ox + digitW - thick, half, thick, half - thick / 2],
      };
      [...SEGMENTS[ch]].forEach((seg) => {
        const [sx, sy, sw, sh] = rects[seg];
        const horizontal = sw > sh;
        ctx.fillRect(
          sx + (horizontal ? shrink : 0),
          sy + (horizontal ? 0 : shrink),
          sw - (horizontal ? shrink * 2 : 0),
          sh - (horizontal ? 0 : shrink * 2)
        );
      });
    }
    ox += widthOf(ch);
  });
  ctx.restore();
}

function drawInstant(ctx, r) {
  const u = Math.min(r.w, r.h);
  const side = u * 0.055;
  const bottom = u * 0.17;
  const inner = { x: r.x + side, y: r.y + side, w: r.w - side * 2, h: r.h - side - bottom };

  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  vignette(ctx, inner, 'rgba(40, 25, 10, 0.3)', 0.55);
  ctx.restore();

  const paper = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  paper.addColorStop(0, '#FBF8F0');
  paper.addColorStop(1, '#E9E1CF');
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.fillStyle = paper;
  ctx.fill('evenodd');

  ctx.strokeStyle = 'rgba(60, 40, 20, 0.28)';
  ctx.lineWidth = Math.max(1, u * 0.004);
  ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
}

function drawFilm35(ctx, r, index) {
  const u = Math.min(r.w, r.h);
  const bar = u * 0.16;
  const holeW = u * 0.045;
  const holeH = u * 0.06;
  const pitch = u * 0.1;
  const holeInset = u * 0.02;

  ctx.fillStyle = '#14110D';
  ctx.fillRect(r.x, r.y, r.w, bar);
  ctx.fillRect(r.x, r.y + r.h - bar, r.w, bar);

  const count = Math.max(1, Math.floor(r.w / pitch));
  const startX = r.x + (r.w - (count - 1) * pitch) / 2 - holeW / 2;
  ctx.fillStyle = 'rgba(236, 226, 205, 0.92)';
  for (let i = 0; i < count; i += 1) {
    const hx = startX + i * pitch;
    ctx.beginPath();
    roundRectPath(ctx, hx, r.y + holeInset, holeW, holeH, u * 0.01);
    roundRectPath(ctx, hx, r.y + r.h - holeInset - holeH, holeW, holeH, u * 0.01);
    ctx.fill();
  }

  const band = bar - holeInset - holeH;
  const fontSize = band * 0.62;
  const frameNo = 12 + index;
  ctx.font = `700 ${fontSize}px ${MONO_FONT}`;
  ctx.fillStyle = '#F0A030';
  ctx.textBaseline = 'middle';
  const pad = u * 0.04;
  const topY = r.y + holeInset + holeH + band / 2;
  const bottomY = r.y + r.h - holeInset - holeH - band / 2;

  ctx.textAlign = 'left';
  ctx.fillText('ISO 400', r.x + pad, topY);
  ctx.fillText(`${frameNo}A \u25B8`, r.x + pad, bottomY);
  ctx.textAlign = 'right';
  ctx.fillText(`\u25B8 ${frameNo}`, r.x + r.w - pad, topY);
  ctx.fillText('SAFETY FILM', r.x + r.w - pad, bottomY);
}

function drawAntique(ctx, r, index) {
  const u = Math.min(r.w, r.h);
  const rand = seededRandom(7 + index * 31);
  const inset = u * 0.075;
  const inner = { x: r.x + inset, y: r.y + inset, w: r.w - inset * 2, h: r.h - inset * 2 };

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  vignette(ctx, r, 'rgba(70, 40, 12, 0.62)', 0.3);
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.arc(r.x + rand() * r.w, r.y + rand() * r.h, u * (0.004 + rand() * 0.012), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(120, 80, 30, ${0.08 + rand() * 0.12})`;
    ctx.fill();
  }

  const paper = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  paper.addColorStop(0, '#F3E7CC');
  paper.addColorStop(1, '#DCC79C');
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  deckledRectPath(ctx, inner, u * 0.008, u * 0.014, rand);
  ctx.fillStyle = paper;
  ctx.fill('evenodd');

  for (let i = 0; i < 40; i += 1) {
    const onTopBottom = rand() < 0.5;
    const sx = onTopBottom ? r.x + rand() * r.w : r.x + (rand() < 0.5 ? rand() * inset : r.w - rand() * inset);
    const sy = onTopBottom ? r.y + (rand() < 0.5 ? rand() * inset : r.h - rand() * inset) : r.y + rand() * r.h;
    ctx.fillStyle = `rgba(110, 75, 35, ${0.1 + rand() * 0.2})`;
    ctx.fillRect(sx, sy, Math.max(1, u * 0.003), Math.max(1, u * 0.003));
  }

  const lineInset = inset * 0.45;
  ctx.strokeStyle = 'rgba(110, 75, 35, 0.5)';
  ctx.lineWidth = Math.max(1, u * 0.003);
  ctx.strokeRect(r.x + lineInset, r.y + lineInset, r.w - lineInset * 2, r.h - lineInset * 2);
  ctx.restore();
}

function drawDisposable(ctx, r) {
  const u = Math.min(r.w, r.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  vignette(ctx, r, 'rgba(10, 6, 2, 0.5)', 0.42);

  ctx.globalCompositeOperation = 'screen';
  const leak = ctx.createLinearGradient(r.x, 0, r.x + r.w * 0.38, 0);
  leak.addColorStop(0, 'rgba(255, 80, 30, 0.6)');
  leak.addColorStop(0.45, 'rgba(255, 150, 60, 0.2)');
  leak.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = leak;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'source-over';

  const now = new Date();
  const text = `'${String(now.getFullYear()).slice(-2)} ${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}`;
  const pad = u * 0.07;
  drawSevenSegmentText(ctx, text, r.x + r.w - pad, r.y + r.h - pad, u * 0.075, '#FF8A1E');
  ctx.restore();
}

function drawVhs(ctx, r, index) {
  const u = Math.min(r.w, r.h);
  const rand = seededRandom(99 + index * 17);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  const lineGap = Math.max(2, u * 0.012);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  for (let ly = r.y; ly < r.y + r.h; ly += lineGap) {
    ctx.fillRect(r.x, ly, r.w, lineGap * 0.45);
  }

  const bandY = r.y + r.h * 0.84;
  const bandH = u * 0.035;
  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = `rgba(255, 255, 255, ${rand() * 0.35})`;
    ctx.fillRect(r.x + rand() * r.w, bandY + rand() * bandH, u * (0.02 + rand() * 0.08), Math.max(1, u * 0.003));
  }

  vignette(ctx, r, 'rgba(0, 0, 12, 0.35)', 0.55);

  const now = new Date();
  const seconds = String((12 + index * 7) % 60).padStart(2, '0');
  const timecode = `SP 00:00:${seconds}`;
  const dateText = `${MONTHS[now.getMonth()]}. ${String(now.getDate()).padStart(2, '0')} ${now.getFullYear()}`;

  const pad = u * 0.06;
  let fontSize = u * 0.08;
  ctx.font = `${fontSize}px ${VHS_FONT}`;
  const textWidth = ctx.measureText(timecode).width + ctx.measureText(dateText).width;
  const available = r.w - pad * 3;
  if (textWidth > available) {
    fontSize *= available / textWidth;
    ctx.font = `${fontSize}px ${VHS_FONT}`;
  }
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowOffsetX = fontSize * 0.07;
  ctx.shadowOffsetY = fontSize * 0.07;

  const dotR = fontSize * 0.26;
  ctx.fillStyle = '#FF3B30';
  ctx.beginPath();
  ctx.arc(r.x + pad + dotR, r.y + pad + fontSize * 0.42, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('REC', r.x + pad + dotR * 2.8, r.y + pad);

  const batW = fontSize * 1.1;
  const batH = fontSize * 0.55;
  const batX = r.x + r.w - pad - batW;
  const batY = r.y + pad + fontSize * 0.14;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1, fontSize * 0.08);
  ctx.strokeRect(batX, batY, batW, batH);
  ctx.fillRect(batX + batW, batY + batH * 0.3, fontSize * 0.1, batH * 0.4);
  ctx.fillRect(batX + batW * 0.12, batY + batH * 0.2, batW * 0.5, batH * 0.6);

  ctx.textBaseline = 'bottom';
  ctx.fillText(timecode, r.x + pad, r.y + r.h - pad);
  ctx.textAlign = 'right';
  ctx.fillText(dateText, r.x + r.w - pad, r.y + r.h - pad);
  ctx.restore();
}

function drawSilentFilm(ctx, r, index) {
  const u = Math.min(r.w, r.h);
  const rand = seededRandom(3 + index * 53);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  vignette(ctx, r, 'rgba(0, 0, 0, 0.72)', 0.38);

  for (let i = 0; i < 3; i += 1) {
    let sx = r.x + rand() * r.w;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 + rand() * 0.22})`;
    ctx.lineWidth = Math.max(1, u * 0.002);
    ctx.beginPath();
    ctx.moveTo(sx, r.y);
    for (let sy = r.y; sy <= r.y + r.h; sy += u * 0.1) {
      sx += (rand() - 0.5) * u * 0.01;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 24; i += 1) {
    ctx.beginPath();
    ctx.arc(r.x + rand() * r.w, r.y + rand() * r.h, u * (0.002 + rand() * 0.005), 0, Math.PI * 2);
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
  }

  const inset = u * 0.035;
  const radius = u * 0.08;
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  roundRectPath(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, radius);
  ctx.fillStyle = '#0B0A09';
  ctx.fill('evenodd');

  const line1 = inset + u * 0.025;
  const line2 = inset + u * 0.038;
  ctx.strokeStyle = 'rgba(240, 232, 214, 0.85)';
  ctx.lineWidth = Math.max(1, u * 0.0045);
  ctx.beginPath();
  roundRectPath(ctx, r.x + line1, r.y + line1, r.w - line1 * 2, r.h - line1 * 2, radius * 0.7);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, u * 0.002);
  ctx.beginPath();
  roundRectPath(ctx, r.x + line2, r.y + line2, r.w - line2 * 2, r.h - line2 * 2, radius * 0.55);
  ctx.stroke();

  const diamond = u * 0.018;
  ctx.fillStyle = 'rgba(240, 232, 214, 0.9)';
  [
    [r.x + r.w / 2, r.y + line1],
    [r.x + r.w / 2, r.y + r.h - line1],
  ].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(dx, dy - diamond);
    ctx.lineTo(dx + diamond * 1.6, dy);
    ctx.lineTo(dx, dy + diamond);
    ctx.lineTo(dx - diamond * 1.6, dy);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

const FRAME_DRAWERS = {
  instant: drawInstant,
  film35: drawFilm35,
  antique: drawAntique,
  disposable: drawDisposable,
  vhs: drawVhs,
  silent: drawSilentFilm,
};

export async function ensureRetroFrameFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`24px ${VHS_FONT}`),
      document.fonts.load(`700 24px ${MONO_FONT}`),
    ]);
  } catch {
    // Fall back to system monospace fonts.
  }
}

/** Draw a retro frame over a photo already painted into rect `{ x, y, w, h }`. */
export function drawRetroFrame(ctx, frameId, rect, { index = 0 } = {}) {
  const draw = FRAME_DRAWERS[frameId];
  if (!draw || !rect?.w || !rect?.h) return;
  ctx.save();
  draw(ctx, rect, index);
  ctx.restore();
}
