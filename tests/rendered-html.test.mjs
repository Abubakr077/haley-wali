import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const database = new DatabaseSync(":memory:");
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: sqliteBinding(database),
    ADMIN_PASSWORD: "test-password",
    ADMIN_SESSION_SECRET: "test-session-secret-that-is-long-enough",
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const signIn = await worker.fetch(new Request("http://localhost/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
  }), env, ctx);
  assert.equal(signIn.status, 200);
  const cookie = signIn.headers.get("set-cookie");
  assert.ok(cookie);
  const response = await worker.fetch(new Request("http://localhost/", {
    headers: { accept: "text/html", cookie },
  }), env, ctx);
  return { response, database };
}

test("server-renders the Haley Wali store manager", async () => {
  const { response, database } = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Store Manager — Haley Wali<\/title>/i);
  assert.match(html, /STORE OVERVIEW/);
  assert.match(html, /ADD A NEW ARTICLE/);
  assert.match(html, /SUPPLIER IMPORT/);
  assert.match(html, /FULFIL ORDER/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  database.close();
});

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
          const result = database.prepare(query).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
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

test("runs the local article, order and tracking lifecycle", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const migrationName of [
    "0000_haley_wali_catalog.sql",
    "0001_store_lifecycle.sql",
  ]) {
    const migration = readFileSync(
      new URL(`../drizzle/${migrationName}`, import.meta.url),
      "utf8",
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("lifecycle", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: sqliteBinding(database),
    ADMIN_PASSWORD: "test-password",
    ADMIN_SESSION_SECRET: "test-session-secret-that-is-long-enough",
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const call = async (path, init) =>
    worker.fetch(new Request(`http://localhost${path}`, init), env, ctx);

  const signInResponse = await call("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
  });
  assert.equal(signInResponse.status, 200);
  const adminCookie = signInResponse.headers.get("set-cookie");
  assert.ok(adminCookie);
  const adminHeaders = { "content-type": "application/json", origin: "http://localhost", cookie: adminCookie };

  const createResponse = await call("/api/admin/articles", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      collection: "exclusive",
      garmentType: "unstitched",
      brand: "Haley Wali",
      title: "Test Exclusive",
      subtitle: "Custom Lawn Suit",
      description: "A complete three-piece lawn article for lifecycle testing.",
      imageUrl: "https://images.example.com/test-exclusive.webp",
      pricePkr: 6500,
      costPricePkr: 4300,
      stockQty: 3,
      pieces: "3 Piece",
      fabric: "Lawn",
      includes: ["Shirt", "Trouser", "Dupatta"],
      action: "publish",
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  const article = created.products.find((product) => product.title === "Test Exclusive");
  assert.ok(article?.id);

  const publicResponse = await call("/api/catalog/articles");
  const publicCatalog = await publicResponse.json();
  assert.ok(publicCatalog.products.some((product) => product.id === article.id));

  const orderResponse = await call("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Local Customer",
      phone: "03001234567",
      address: "Street 1",
      city: "Lahore",
      checkoutToken: "test-checkout-token-0001",
      items: [{ id: article.id, size: "Standard", quantity: 1 }],
    }),
  });
  const orderPayload = await orderResponse.json();
  assert.equal(orderResponse.status, 201, JSON.stringify(orderPayload));
  assert.match(orderPayload.order.number, /^HW-[0-9A-F]{10}$/);

  const trackResponse = await call(
    `/api/orders/track?number=${orderPayload.order.number}&phone=03001234567`,
  );
  const tracked = await trackResponse.json();
  assert.equal(tracked.order.status, "received");

  const adminOrdersResponse = await call("/api/admin/orders", { headers: { cookie: adminCookie } });
  const adminOrders = await adminOrdersResponse.json();
  assert.equal(adminOrders.orders.length, 1);
  database.close();
});
