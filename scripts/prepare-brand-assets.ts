/**
 * Processes the raw Navaro logo PNGs in assets/brand-source/ into transparent,
 * trimmed, correctly-padded assets under public/brand/ and app/. Run once
 * (`npm run brand:prepare`) and commit the outputs — see NAVARO CRM prompt §7.2.
 *
 * The source PNGs are opaque with a near-white (#FEFDF9) background and no
 * transparency. This script keys that background out to alpha (by colour
 * distance only — it never touches RGB), trims to the artwork bounding box,
 * then re-pads with the brand's clearspace rule (x = the logomark's own
 * height, on all sides; x/4 for the standalone mark's square canvas).
 *
 * navaro-logo-vertical.png is a known-broken asset (cropped wordmark) and is
 * intentionally never read here.
 */
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'brand-source');
const PUBLIC_BRAND_DIR = path.join(ROOT, 'public', 'brand');
const APP_DIR = path.join(ROOT, 'app');

const BG_COLOR = { r: 254, g: 253, b: 249 }; // #FEFDF9, the source PNGs' flat background
const KEY_TOLERANCE = 20;

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
  channels: 4;
}

async function loadWithAlpha(filePath: string): Promise<RawImage> {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), width: info.width, height: info.height, channels: 4 };
}

/** Keys the flat background colour out to alpha. Only ever writes the alpha channel. */
function keyOutBackground(img: RawImage): RawImage {
  const { data, width, height, channels } = img;
  const innerBand = KEY_TOLERANCE * 0.3;
  for (let i = 0; i < width * height; i++) {
    const idx = i * channels;
    const dr = data[idx] - BG_COLOR.r;
    const dg = data[idx + 1] - BG_COLOR.g;
    const db = data[idx + 2] - BG_COLOR.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    let alpha: number;
    if (dist <= innerBand) alpha = 0;
    else if (dist >= KEY_TOLERANCE) alpha = 255;
    else alpha = Math.round(((dist - innerBand) / (KEY_TOLERANCE - innerBand)) * 255);

    data[idx + 3] = Math.min(data[idx + 3], alpha);
  }
  return img;
}

/** Bounding box of pixels whose alpha exceeds a visibility threshold. */
function findArtworkBBox(img: RawImage, alphaThreshold = 10) {
  const { data, width, height, channels } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('No non-transparent artwork found — background keying may have failed.');
  }

  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function trimmedTransparentImage(filePath: string) {
  const raw = keyOutBackground(await loadWithAlpha(filePath));
  const bbox = findArtworkBBox(raw);
  const keyed = sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 4 } });
  const trimmed = await keyed.extract(bbox).png().toBuffer();
  return { buffer: trimmed, width: bbox.width, height: bbox.height };
}

async function padTransparent(buffer: Buffer, pad: number) {
  return sharp(buffer)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function processHorizontalLogo() {
  const { buffer, height } = await trimmedTransparentImage(path.join(SOURCE_DIR, 'navaro-logo-horizontal.png'));
  const clearspace = height; // x = the logomark's own height
  const withClearspace = await padTransparent(buffer, clearspace);

  // Artwork-only variant for UI use: clearspace is then applied by layout padding,
  // so the rendered height is the real logomark height rather than 1/3 of it.
  await sharp(buffer).toFile(path.join(PUBLIC_BRAND_DIR, 'logo-horizontal-trim.png'));

  await sharp(withClearspace).toFile(path.join(PUBLIC_BRAND_DIR, 'logo-horizontal.png'));
  await sharp(withClearspace).resize({ width: 480 }).toFile(path.join(PUBLIC_BRAND_DIR, 'logo-horizontal@1x.png'));

  console.log(`logo-horizontal: artwork height ${height}px, clearspace ${clearspace}px`);
}

async function processMark() {
  const { buffer, width, height } = await trimmedTransparentImage(path.join(SOURCE_DIR, 'navaro-logo-mark.png'));
  const clearspace = Math.round(Math.max(width, height) / 4); // x/4 for the standalone mark

  // Centre the (near-square) trimmed artwork on a square canvas before padding.
  const side = Math.max(width, height);
  const centered = await sharp(buffer)
    .extend({
      top: Math.floor((side - height) / 2),
      bottom: Math.ceil((side - height) / 2),
      left: Math.floor((side - width) / 2),
      right: Math.ceil((side - width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const withClearspace = await padTransparent(centered, clearspace);

  await sharp(withClearspace).resize(512, 512).toFile(path.join(PUBLIC_BRAND_DIR, 'logo-mark.png'));
  await sharp(withClearspace).resize(512, 512).toFile(path.join(APP_DIR, 'icon.png'));
  await sharp(withClearspace)
    .resize(180, 180)
    .flatten({ background: '#FFFFFF' })
    .toFile(path.join(APP_DIR, 'apple-icon.png'));

  console.log(`logo-mark: artwork ${width}x${height}px, clearspace ${clearspace}px`);
}

async function main() {
  const fs = await import('node:fs/promises');
  await fs.mkdir(PUBLIC_BRAND_DIR, { recursive: true });

  await processHorizontalLogo();
  await processMark();

  console.log('Brand assets written to public/brand/, app/icon.png and app/apple-icon.png.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
