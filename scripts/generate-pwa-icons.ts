/**
 * One-off/rerunnable asset pipeline: generates the full PWA icon set from
 * the real Mt Hood Lanes logo (Milestone 21). Not part of `npm run build` —
 * run manually (`npm run icons:generate`) whenever the source logo changes;
 * the generated PNGs are committed to `src/renderer/public/icons/` like any
 * other static asset (mirrors `scripts/seed.ts`'s pattern of a maintenance
 * script that isn't part of the normal build/test pipeline).
 *
 * Produces:
 *   - icon-192.png            192x192, transparent, purpose "any"
 *   - icon-512.png            512x512, transparent, purpose "any"
 *   - maskable-icon-512.png   512x512, opaque bg, purpose "maskable"
 *   - apple-touch-icon-180.png 180x180, opaque bg (iOS applies its own mask)
 *   - favicon-32.png          32x32, opaque bg
 *
 * Maskable icon safe zone: the PWA spec's safe zone is the circle inscribed
 * in the icon (radius = 40% of the icon size, i.e. diameter 80%) — anything
 * outside it may be cropped by aggressive OS icon masks. The source logo is
 * a wide badge (~1.42:1 aspect ratio), so it's scaled to 42% of the canvas
 * width here (~30% padding per side) rather than a literal "40% padding on
 * each side" (which would leave only ~20% of the canvas for content and
 * make the logo illegible) — at 42% width the logo's half-diagonal is
 * ~131px against a 205px safe radius on a 512px canvas, i.e. it sits
 * comfortably inside the safe zone with significant margin to spare.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, '..');
const sourceLogo = path.join(projectRoot, 'MT-Hood-Lanes-logo-2025-2.png');
const outDir = path.join(projectRoot, 'src/renderer/public/icons');

// Matches `--color-bg` (light mode, theme.css) — the manifest's
// `background_color`, so opaque icon backgrounds visually match the app.
const BRAND_BG = '#faf6f0';

const LOGO_ASPECT_RATIO = 3000 / 2116;

interface IconSpec {
  file: string;
  size: number;
  /** Fraction of the canvas width the logo content occupies. */
  contentFraction: number;
  /** Opaque background color, or `null` for a transparent canvas. */
  background: string | null;
}

const specs: IconSpec[] = [
  { file: 'icon-192.png', size: 192, contentFraction: 0.8, background: null },
  { file: 'icon-512.png', size: 512, contentFraction: 0.8, background: null },
  { file: 'maskable-icon-512.png', size: 512, contentFraction: 0.42, background: BRAND_BG },
  { file: 'apple-touch-icon-180.png', size: 180, contentFraction: 0.86, background: BRAND_BG },
  { file: 'favicon-32.png', size: 32, contentFraction: 0.86, background: BRAND_BG },
];

async function generateIcon(spec: IconSpec): Promise<void> {
  const logoWidth = Math.round(spec.size * spec.contentFraction);
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT_RATIO);

  const resizedLogo = await sharp(sourceLogo)
    .resize({ width: logoWidth, height: logoHeight, fit: 'contain' })
    .toBuffer();

  const canvas = sharp({
    create: {
      width: spec.size,
      height: spec.size,
      channels: 4,
      background: spec.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const outputPath = path.join(outDir, spec.file);
  await canvas
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toFile(outputPath);

  // eslint-disable-next-line no-console -- maintenance script, output is intentional
  console.log(`Generated ${path.relative(projectRoot, outputPath)} (${spec.size}x${spec.size})`);
}

async function main(): Promise<void> {
  await Promise.all(specs.map(generateIcon));
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- maintenance script, output is intentional
  console.error('Icon generation failed:', error);
  process.exitCode = 1;
});
