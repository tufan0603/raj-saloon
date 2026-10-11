/**
 * Generate every app icon from the salon logo.
 *   1. Put the logo at client/public/brand/logo.png (PNG/JPG/WEBP, ideally square or circular, >= 512px)
 *   2. npm run icons
 * Outputs: public/icons/{icon-192,icon-512,maskable-192,maskable-512,apple-touch-icon,favicon-32}.png,
 *          public/brand/logo-512.png (optimised copy), and updates manifest.json name/short_name from NEXT_PUBLIC_APP_NAME.
 */
import sharp from 'sharp';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const candidates = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp'].map((f) => path.join(pub, 'brand', f));
const src = candidates.find((f) => existsSync(f));
if (!src) {
  console.error('Logo not found. Save it as client/public/brand/logo.png and run again.');
  process.exit(1);
}

const BG = process.env.ICON_BG || '#f8f3e7'; // cream, matches the logo background
const envFile = path.join(root, '.env.local');
const appName = (process.env.NEXT_PUBLIC_APP_NAME || (existsSync(envFile) ? (readFileSync(envFile, 'utf8').match(/^NEXT_PUBLIC_APP_NAME=(.*)$/m) || [])[1] : '') || 'SaloonEase').trim().replace(/^"|"$/g, '');

/** Square canvas with the logo contained inside, `pad` fraction of padding on each side. */
async function tile(size, pad, out, { flatten = true } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(src).trim({ threshold: 12 }).resize(inner, inner, { fit: 'contain', background: BG }).toBuffer();
  let img = sharp({ create: { width: size, height: size, channels: 4, background: BG } }).composite([{ input: logo, gravity: 'centre' }]);
  if (flatten) img = img.flatten({ background: BG });
  await img.png({ compressionLevel: 9 }).toFile(path.join(pub, 'icons', out));
  console.log('wrote icons/' + out);
}

await tile(192, 0.06, 'icon-192.png');
await tile(512, 0.06, 'icon-512.png');
await tile(192, 0.18, 'maskable-192.png'); // maskable safe zone
await tile(512, 0.18, 'maskable-512.png');
await tile(180, 0.08, 'apple-touch-icon.png');
await tile(32, 0.0, 'favicon-32.png');
await tile(64, 0.0, 'favicon-64.png');

await sharp(src).trim({ threshold: 12 }).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(pub, 'brand', 'logo-512.png'));
console.log('wrote brand/logo-512.png');

const manifestPath = path.join(pub, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.name = `${appName} - Salon Queue & Booking`;
manifest.short_name = appName.slice(0, 12);
manifest.background_color = BG;
manifest.shortcuts?.forEach((s) => (s.icons = [{ src: '/icons/icon-192.png', sizes: '192x192' }]));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json updated (name: ${manifest.name})`);
console.log('Done. Bump VERSION in public/sw.js so installed apps refresh their icon cache.');
