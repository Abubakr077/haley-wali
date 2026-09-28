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
