import sharp from 'sharp';
import { loadImageSources } from './storefront-image-sources.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../apps/storefront/', import.meta.url);
const output = new URL('public/generated-images/', root);
await mkdir(output, { recursive: true });
const manifest = {};
const sources = ['/assets/campaign-hero.png', '/assets/season-end-sale-hero.png', '/assets/mehr-hero-slide.png', '/assets/collection-sheet.png', '/assets/sapphire.webp'];
const api = process.env.PUBLIC_CATALOG_API_BASE || 'https://manager.haleywali.pk';
const required = process.env.HALEY_REQUIRE_ARTICLE_IMAGES === '1';
sources.push(...await loadImageSources({
  file: process.env.HALEY_ARTICLE_IMAGE_SOURCES,
  api, required, readFile,
}));
let failed = 0;
const queue = [...new Set(sources.filter(Boolean))];
async function convert(source) {
  const local = source.startsWith('/assets/');
  if (!local) {
    const url = new URL(source);
    // Do not fetch arbitrary supplier hosts or private network addresses during CI.
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || !url.pathname.startsWith('/storage/v1/object/public/')) return;
  }
  const bytes = local ? await readFile(new URL(`public${source}`, root)) : await download(source);
  const id = createHash('sha256').update(source).update(bytes).digest('hex').slice(0, 20);
  const metadata = await sharp(bytes).rotate().metadata();
  const widths = [320, 640, 960, 1600].filter(width => width < metadata.width);
  widths.push(Math.min(metadata.width, 1920));
  const variants = [];
  for (const width of [...new Set(widths)].sort((a,b) => a-b)) {
    const name = `${id}-${width}.webp`;
    const { info } = await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true }).then(async result => {
      await writeFile(new URL(name, output), result.data);
      return result;
    });
    variants.push({ src: `/generated-images/${name}`, width: info.width, height: info.height });
  }
  manifest[source] = variants;
}
async function download(source) {
  const response = await fetch(source, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error('Image unavailable');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 12 * 1024 * 1024) throw new Error('Image too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const source = queue.shift();
    try { await convert(source); } catch (error) {
      if (source.startsWith('/assets/')) throw error;
      failed++;
    }
  }
}));
if (required && failed) throw new Error(`Responsive images: ${failed} required article photos failed; release stopped.`);
await writeFile(new URL('src/lib/image-manifest.json', root), JSON.stringify(manifest));
console.log(`Responsive images: ${Object.keys(manifest).length} sources prepared; ${failed} remote fallbacks.`);
