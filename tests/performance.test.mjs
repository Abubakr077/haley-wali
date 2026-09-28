import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRead } from '../worker/public-cache.ts';
import { publicJson } from '../apps/storefront/src/lib/publicFetch.ts';

function mockCache(t, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', { configurable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'caches', previous);
    else delete globalThis.caches;
  });
}

test('public cache separates CORS origins, reuses responses and bypasses private requests', async (t) => {
  const stored = new Map();
  mockCache(t, { default: {
    match: async key => stored.get(key.url)?.clone(),
    put: async (key, value) => { stored.set(key.url, value); },
  }});
  const pending = [];
  const ctx = { waitUntil: promise => pending.push(promise) };
  let calls = 0;
  const load = async () => { calls++; return new Response('{"products":[]}', { headers: {'cache-control': 'public, max-age=10, s-maxage=30'} }); };
  const request = (path='/api/catalog/articles', headers={}) => new Request(`https://manager.haleywali.pk${path}`, {headers});
  assert.equal((await publicRead(request(), load, ctx)).headers.get('x-public-cache'), 'MISS');
  await Promise.all(pending);
  assert.equal((await publicRead(request(), load, ctx)).headers.get('x-public-cache'), 'HIT');
  assert.equal(calls, 1);
  await publicRead(request('/api/catalog/articles', {origin:'https://haleywali.pk'}), load, ctx);
  assert.equal(calls, 2);
  for (const path of ['/api/admin/orders', '/api/orders', '/api/orders/track']) {
    await publicRead(request(path), load, ctx);
    await publicRead(request(path), load, ctx);
  }
  await publicRead(request('/api/catalog/articles', {cookie:'session=test'}), load, ctx);
  assert.equal(calls, 9);
});

test('public cache does not retain errors', async (t) => {
  let writes = 0;
  mockCache(t, {default:{match:async()=>undefined, put:async()=>{writes++;}}});
  const response = await publicRead(new Request('https://manager.haleywali.pk/api/shop/settings'),
    async()=>new Response('unavailable', {status:503}), {waitUntil(){}});
  assert.equal(response.status,503);
  assert.equal(writes,0);
});

test('public JSON deadline aborts a stalled request and rejects HTTP failures', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async (_url, {signal}) => new Promise((_,reject) => {
    signal.addEventListener('abort',()=>reject(new Error('aborted')), {once:true});
  }));
  await assert.rejects(publicJson('https://example.com/api/catalog/articles', 15), /aborted/);
  globalThis.fetch.mock.mockImplementation(async()=>new Response('failure', {status:503}));
  await assert.rejects(publicJson('https://example.com/api/catalog/articles'), /HTTP 503/);
});

test('cache hits restore short browser TTLs even when the cache returns a zone override', async t => {
  mockCache(t, { default: { match: async () => new Response('{}', {
    headers: { 'cache-control': 'public, max-age=14400, s-maxage=30', age: '5' },
  }) }});
  for (const [path, expected] of [
    ['/api/catalog/articles', 'public, max-age=10, s-maxage=30'],
    ['/api/reviews?latest=1', 'public, max-age=10, s-maxage=30'],
    ['/api/shop/settings', 'public, max-age=30, s-maxage=60'],
  ]) {
    const result = await publicRead(new Request(`https://manager.haleywali.pk${path}`),
      () => { throw new Error('Cache should satisfy this request'); }, { waitUntil() {} });
    assert.equal(result.headers.get('cache-control'), expected);
    assert.equal(result.headers.get('age'), '5');
  }
});

test('release image input selects only public media and fails closed on invalid input', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { publishedImageQuery, imageSourcesFromD1, loadImageSources } = await import('../scripts/storefront-image-sources.mjs');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE manual_products(image_url TEXT, gallery_json TEXT, publish_status TEXT, selling_price_pkr INTEGER, cost_price_pkr INTEGER);
      CREATE TABLE catalog_products(supplier_product_id TEXT, category TEXT, publish_status TEXT, selling_price_pkr INTEGER);
      CREATE TABLE supplier_products(id TEXT, image_url TEXT, gallery_json TEXT);
      INSERT INTO manual_products VALUES ('public', '["gallery", "public"]', 'published', 100, 50),
        ('draft', '[]', 'draft', 100, 50), ('unpriced', '[]', 'published', NULL, 50);
      INSERT INTO supplier_products VALUES ('one', 'imported', '[]');
      INSERT INTO catalog_products VALUES ('one', 'pret', 'published', 100);`);
    const results = db.prepare(publishedImageQuery).all();
    assert.deepEqual(Object.keys(results[0]).sort(), ['galleryJson','imageUrl']);
    const sources = imageSourcesFromD1([{ success: true, results }]);
    assert.deepEqual(sources, ['public', 'gallery', 'imported']);
    assert.throws(() => imageSourcesFromD1([{ success: false, results: [] }]));
    assert.deepEqual(await loadImageSources({ file: 'snapshot', readFile: async () => JSON.stringify(sources),
      fetcher: () => { throw new Error('Snapshot must not depend on public API'); } }), sources);
    await assert.rejects(loadImageSources({ api: 'https://example.com', required: true,
      fetcher: async () => new Response('blocked', { status: 403 }) }), /Required catalogue/);
    await assert.rejects(loadImageSources({ file: 'snapshot', readFile: async () => '{}' }), /Invalid published/);
  } finally { db.close(); }
});
