import QRCode from 'qrcode';

export type CardTheme = 'cream' | 'dark' | 'emerald';

export interface CardOptions {
  salonName: string;
  tagline?: string;
  headline: string;
  url: string;
  hours: string; // "10:00 AM - 9:00 PM"
  offDays?: string; // "Closed on Sunday"
  address?: string;
  phone?: string;
  footer?: string;
  logoUrl?: string | null;
  theme: CardTheme;
  showAddress: boolean;
  showPhone: boolean;
  showHours: boolean;
}

export const CARD_W = 1080;
export const CARD_H = 1528; // A-series ratio (1:1.414): prints cleanly on A6 / A5 / A4

const THEMES: Record<CardTheme, { bg: string; bg2: string; text: string; muted: string; accent: string; panel: string; qrDark: string }> = {
  cream: { bg: '#f8f3e7', bg2: '#f1e9d6', text: '#1e293b', muted: '#64748b', accent: '#b8862b', panel: '#ffffff', qrDark: '#1e293b' },
  dark: { bg: '#0f172a', bg2: '#1e293b', text: '#ffffff', muted: '#cbd5e1', accent: '#34d399', panel: '#ffffff', qrDark: '#0f172a' },
  emerald: { bg: '#047857', bg2: '#065f46', text: '#ffffff', muted: '#d1fae5', accent: '#fcd34d', panel: '#ffffff', qrDark: '#064e3b' },
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + '...';
    return cut;
  }
  return lines;
}

const font = (weight: number, size: number) => `${weight} ${size}px Inter, "Segoe UI", system-ui, -apple-system, sans-serif`;

/** Draws the printable shop card (1080x1440) onto the given canvas. */
export async function drawShopCard(canvas: HTMLCanvasElement, o: CardOptions) {
  const t = THEMES[o.theme];
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  try {
    await (document as any).fonts?.ready;
  } catch {}

  // background
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, t.bg);
  g.addColorStop(1, t.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // frame
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 5;
  roundRect(ctx, 40, 40, CARD_W - 80, CARD_H - 80, 36);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  roundRect(ctx, 56, 56, CARD_W - 112, CARD_H - 112, 28);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = 120;

  // logo
  const logo = o.logoUrl ? await loadImage(o.logoUrl) : null;
  const logoSize = 230;
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CARD_W / 2, y + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#f8f3e7';
    ctx.fill();
    ctx.clip();
    const scale = Math.max(logoSize / logo.width, logoSize / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;
    ctx.drawImage(logo, CARD_W / 2 - w / 2, y + logoSize / 2 - h / 2, w, h);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(CARD_W / 2, y + logoSize / 2, logoSize / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 6;
    ctx.stroke();
    y += logoSize + 56;
  } else {
    y += 20;
  }

  // name + tagline
  ctx.fillStyle = t.text;
  ctx.font = font(900, 86);
  const nameLines = wrap(ctx, o.salonName, CARD_W - 200, 2);
  nameLines.forEach((l) => {
    ctx.fillText(l, CARD_W / 2, y + 70);
    y += 96;
  });
  if (o.tagline) {
    ctx.fillStyle = t.muted;
    ctx.font = font(500, 36);
    ctx.fillText(o.tagline, CARD_W / 2, y + 30);
    y += 70;
  }

  // divider
  y += 22;
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CARD_W / 2 - 120, y);
  ctx.lineTo(CARD_W / 2 + 120, y);
  ctx.stroke();
  y += 56;

  // headline
  ctx.fillStyle = t.accent;
  ctx.font = font(800, 50);
  ctx.fillText(o.headline, CARD_W / 2, y + 40);
  y += 86;

  // QR panel
  const panel = 450;
  const px = CARD_W / 2 - panel / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = t.panel;
  roundRect(ctx, px, y, panel, panel, 40);
  ctx.fill();
  ctx.restore();
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, o.url, { width: panel - 72, margin: 0, errorCorrectionLevel: 'M', color: { dark: t.qrDark, light: '#ffffff' } });
  ctx.drawImage(qr, px + 36, y + 36);
  y += panel + 54;

  // url
  ctx.fillStyle = t.muted;
  ctx.font = font(500, 28);
  ctx.fillText('or visit', CARD_W / 2, y);
  y += 44;
  ctx.fillStyle = t.text;
  ctx.font = font(700, 34);
  ctx.fillText(o.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), CARD_W / 2, y);
  y += 72;

  // info rows (hours / address / phone), each wrapped to at most two lines
  const rows: string[] = [];
  if (o.showHours && o.hours) rows.push(`${o.hours}${o.offDays ? `  |  ${o.offDays}` : ''}`);
  if (o.showAddress && o.address) rows.push(o.address);
  if (o.showPhone && o.phone) rows.push(`Call / WhatsApp: ${o.phone}`);
  const footerY = CARD_H - 84;
  const rowFont = rows.length > 2 ? 30 : 32;
  ctx.font = font(600, rowFont);
  const lineH = rowFont + 12;
  const needed = rows.reduce((n, r) => n + wrap(ctx, r, CARD_W - 220, 2).length, 0) * lineH + rows.length * 8;
  // keep everything above the footer: shrink the gap first, then the font
  if (y + needed > footerY - 40) {
    y = Math.max(y - 30, 0);
    if (y + needed > footerY - 40) ctx.font = font(600, rowFont - 4);
  }
  for (const r of rows) {
    const lines = wrap(ctx, r, CARD_W - 220, 2);
    for (const l of lines) {
      ctx.fillStyle = t.text;
      ctx.fillText(l, CARD_W / 2, y);
      y += lineH;
    }
    y += 8;
  }

  // footer (skipped if the rows ran into its space)
  if (o.footer && y <= footerY - 30) {
    ctx.fillStyle = t.muted;
    ctx.font = font(500, 26);
    const lines = wrap(ctx, o.footer, CARD_W - 200, 1);
    ctx.fillText(lines[0], CARD_W / 2, footerY);
  }
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
