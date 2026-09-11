import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function sqliteBinding(database) {
  return {
    prepare(query) {
      let values = [];
      return {
        bind(...nextValues) {
          values = nextValues;
          return this;
        },
        async run() {
          database.prepare(query).run(...values);
          return { success: true };
        },
        async first() {
          return database.prepare(query).get(...values) ?? null;
        },
        async all() {
          return { results: database.prepare(query).all(...values) };
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };
}

test("uploads, moderates and publishes an optional review photo", async (context) => {
  const database = new DatabaseSync(":memory:");
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("review-images", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const uploads = [];
  context.mock.method(globalThis, "fetch", async (input, init) => {
    uploads.push({ url: String(input), init });
    return new Response("{}", { status: 201 });
  });
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: sqliteBinding(database),
    SUPABASE_URL: "https://review-test.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_test",
    SUPABASE_STORAGE_BUCKET: "haley-wali-articles",
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const call = (path, init) => worker.fetch(new Request(`http://localhost${path}`, init), env, ctx);

  await call("/api/reviews?productId=review-article");
  database.prepare(
    `INSERT INTO manual_products
       (id, public_title, publish_status, stock_qty, created_at, updated_at)
     VALUES ('review-article', 'Review Article', 'published', 1, ?, ?)`,
  ).run(new Date().toISOString(), new Date().toISOString());

  const imageBytes = new Uint8Array(24);
  imageBytes.set([0x52, 0x49, 0x46, 0x46], 0);
  imageBytes.set([0x57, 0x45, 0x42, 0x50], 8);
  const form = new FormData();
  form.set("productId", "review-article");
  form.set("name", "Customer");
  form.set("rating", "5");
  form.set("title", "Lovely article");
  form.set("comment", "The fabric and finishing are lovely.");
  form.set("website", "");
  form.set("image", new File([imageBytes], "review-photo.webp", { type: "image/webp" }));

  const submission = await call("/api/reviews", { method: "POST", body: form });
  assert.equal(submission.status, 201);
  assert.equal(uploads.length, 1);
  assert.match(uploads[0].url, /\/haley-wali-articles\/reviews\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/);
  assert.equal(uploads[0].init.method, "POST");
  assert.equal(uploads[0].init.headers["content-type"], "image/webp");

  const stored = database.prepare(
    "SELECT id, image_url AS imageUrl, status FROM product_reviews",
  ).get();
  assert.equal(stored.status, "pending");
  assert.match(stored.imageUrl, /\/reviews\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/);

  const pendingResponse = await call("/api/reviews?productId=review-article");
  assert.deepEqual((await pendingResponse.json()).reviews, []);

  database.prepare("UPDATE product_reviews SET status = 'approved' WHERE id = ?").run(stored.id);
  const approvedResponse = await call("/api/reviews?productId=review-article");
  const approved = await approvedResponse.json();
  assert.equal(approved.reviews.length, 1);
  assert.equal(approved.reviews[0].imageUrl, stored.imageUrl);
  database.close();
});
