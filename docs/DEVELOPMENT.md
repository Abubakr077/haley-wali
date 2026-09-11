# Development, testing and deployment

## Requirements

- Node.js 22.13 or newer.
- npm and the existing `package-lock.json`.
- Run commands from the repository root.

## Local setup

```bash
npm install
npm run dev
```

The store manager/API normally opens at `http://127.0.0.1:3000`. The development
script binds to this IPv4 address explicitly so the Astro storefront and manager
API use the same local host.

In a second terminal:

```bash
npm run dev:storefront
```

The customer storefront normally opens at `http://127.0.0.1:4321`.

The storefront defaults its API base to `http://127.0.0.1:3000` in local use.
For another API host, provide `PUBLIC_CATALOG_API_BASE` when building/running the
storefront.

The Store Manager sidebar defaults its customer-shop link to
`http://127.0.0.1:4321`. Set `NEXT_PUBLIC_STOREFRONT_URL` for another local or
deployed storefront URL.

Both Wrangler configurations use compatibility date `2026-05-22`, the newest
date supported by the currently installed local Workers runtime. Keep the two
configurations aligned when the runtime dependency is upgraded.

The root Worker has an `AI` binding for Store Manager brand-name suggestions.
It needs no API key. Suggestions are requested only when the manager selects
`AI Suggestions`, use a short response limit and are cached within an active
Worker isolate. Selecting a result persists it to the approved-brand registry,
so later articles reuse that name without AI. Typing never invokes Workers AI.

## Local Store Manager sign-in

The Cloudflare Worker reads local secrets from root `.dev.vars`, not `.env` or
`.env.local`. Copy `.dev.vars.example` to `.dev.vars`, set a password, generate
a different long session secret, then restart `npm run dev`. The real
`.dev.vars` file is ignored by git.

`npm run configure:supabase-storage` saves secrets to the deployed Cloudflare
Worker only. For local image uploads, also add `SUPABASE_URL`,
`SUPABASE_SECRET_KEY` and `SUPABASE_STORAGE_BUCKET` to `.dev.vars`.
`SUPABASE_URL` should normally be the project origin ending in `.supabase.co`;
the Worker safely removes an accidentally copied path such as `/rest/v1`.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start manager and Worker API locally. |
| `npm run dev:storefront` | Start Astro customer shop locally. |
| `npm run import:supplier` | Run supplier import against the local database. |
| `npm run build` | Build manager/API through vinext. |
| `npm run build:storefront` | Build Astro storefront. |
| `npm run build:all` | Build both applications. |
| `npm run check --workspace @haley-wali/storefront` | Astro and TypeScript checks. |
| `npm run test:catalog` | Import and pricing unit tests. |
| `npm test` | Catalog tests, both builds, rendered manager, D1 lifecycle and review-photo lifecycle tests. |
| `npm run lint` | ESLint, excluding generated build directories. |
| `npm run db:generate` | Generate a migration after schema edits. |

Do not edit generated `dist/` or `apps/storefront/dist/` files. Change source and
rebuild. `outputs/textile-ledger-homepage/` and `work/storefront-sample/` are old
prototype/reference areas, not current product source.

## Local data

- Command-line import database: `.data/haley-wali.db`.
- Import preview snapshot: `modules/catalog-import/imported-products.json`.
- The snapshot contains public supplier data only and is not the owner pricing
  database.
- Never commit customer order exports, access tokens or private invoice data.

## Environment values

Runtime values are documented in `.dev.vars.example` and `.env.example`:

```text
PUBLIC_WHATSAPP_NUMBER
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
PUBLIC_STOREFRONT_ORIGIN
SUPABASE_URL
SUPABASE_SECRET_KEY
SUPABASE_STORAGE_BUCKET
```

`PUBLIC_WHATSAPP_NUMBER` enables the free customer confirmation link and should
use country-code format such as `923001234567`, without `+`, spaces or dashes.
The storefront reads the repository-root `.env` through its Vite environment
directory. Only the `PUBLIC_` value is exposed to browser code. No Meta API
credentials are required.
The Store Manager intentionally refuses sign-in until `ADMIN_PASSWORD` and a
long random `ADMIN_SESSION_SECRET` are configured. On Cloudflare these remain
environment secrets and do not require a paid authentication provider.

## Change process

1. Read `docs/README.md` and `docs/CURRENT_STATUS.md`.
2. Inspect the exact files involved; do not assume old conversation details are
   still implemented.
3. Preserve the Astro + React-islands storefront and the existing Worker/D1
   architecture unless the owner approves an architecture change.
4. Add a D1 migration for persistent schema changes.
5. Do not run automated tests after routine changes. The owner will request a
   test or full verification run when wanted.
6. When verification is requested, run focused checks, then `npm test` for
   cross-application changes.
7. Manually review affected desktop and mobile pages when UI changes.
8. Update this context folder and `CURRENT_STATUS.md`.

## Deployment notes

### Normal Git-based release flow

The canonical repository is `https://github.com/Abubakr077/haley-wali.git` and
the production branch is `main`. Future work starts with:

```bash
git pull --ff-only origin main
```

After the change is reviewed and committed, `git push origin main` is the normal
release trigger. `.github/workflows/deploy.yml` installs from the lockfile, runs
`npm test`, and only then runs the existing guarded incremental deployment. The
deployment applies forward-only D1 migrations, publishes the manager/API before
the storefront and checks the manual-article, imported-article and order counts
before and after.

Configure these GitHub Actions values once under repository Settings -> Secrets
and variables -> Actions:

- Secret `CLOUDFLARE_API_TOKEN`: a restricted Cloudflare deployment token with
  access to the two Workers, D1 migrations and the Haley Wali zone routes.
- Secret `CLOUDFLARE_ACCOUNT_ID`: the owning Cloudflare account ID.
- Variable `PUBLIC_WHATSAPP_NUMBER`: the public country-code number without `+`,
  spaces or dashes.
- Variable `HALEY_WALI_DEPLOY_ENABLED`: keep absent or `false` until the first
  GitHub-driven release is approved, then set it to `true`.

The workflow is deliberately disabled while the enable variable is absent, so
creating or updating the GitHub repository cannot deploy by itself. Keep
`npm run deploy:cloudflare:update` for an explicitly approved recovery only; do
not use it as the normal local release path.

- Current production target is Cloudflare Workers with D1 for shop data and a
  public Supabase Storage bucket for browser-optimized article images. Launch
  does not require R2 or Cloudflare payment details.
- The Cloudflare zone has an active `Redirect www to haleywali.pk` Single
  Redirect. It uses a permanent 301, keeps the original path and query string,
  and makes `https://haleywali.pk` the only canonical public origin. Do not
  remove it when updating Worker custom domains.
- Do not deploy through ChatGPT Sites. The Store Manager/API uses
  `wrangler.jsonc`; the public Astro storefront uses
  `apps/storefront/wrangler.jsonc`.
- Authenticate once with
  `XDG_CONFIG_HOME="$PWD/.wrangler/config" npx wrangler login`. The project-local
  Wrangler state is ignored and must never be committed.
- Create the `haley-wali-production` D1 database once. The first-release
  deployment script creates or reuses it and updates `wrangler.jsonc`.
- Set `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` and the remaining runtime values
  with `wrangler secret put`; do not place production secrets in config files.
- Create a public Supabase Storage bucket named `haley-wali-articles`, then run
  `npm run configure:supabase-storage`. Paste the Project URL, server-side
  `sb_secret_` key and bucket name only at Wrangler's hidden prompts. A legacy
  service-role JWT is accepted if the project does not offer the newer key.
  The incremental deployment command refuses to deploy if these three Worker
  secrets are missing.
- Build the storefront with `PUBLIC_CATALOG_API_BASE` set to
  `https://manager.haleywali.pk`. Set the manager's
  `PUBLIC_STOREFRONT_ORIGIN` allow-list to `https://haleywali.pk` and its `www`
  redirect origin only.
- `npm run deploy:manager` and `npm run deploy:storefront` publish the two
  Cloudflare Workers.
- The manager Worker is declared as the custom domain
  `manager.haleywali.pk` in the root `wrangler.jsonc`. Its `workers.dev` and
  preview URLs are disabled. No registrar change is required while Cloudflare
  remains the authoritative DNS provider. These production routes do not alter
  local manager development or its local database.
- Both deployment scripts use the canonical production URLs directly:
  `https://haleywali.pk` for the customer shop and
  `https://manager.haleywali.pk` for Store Manager and its API. They do not
  discover or persist Worker subdomain URLs.
- `npm run deploy:cloudflare` is the first-release command. It creates or reuses
  the production D1 database, applies migrations, asks privately for the Store
  Manager password, builds both applications, deploys both Workers, connects
  their URLs and confirms that the article tables are empty.
- `npm run deploy:cloudflare:update` is the safe incremental command used by the
  GitHub Actions release and by an explicitly approved recovery.
  It records the current manual-article, imported-article and order counts,
  applies forward D1 migrations, deploys both Workers without rotating secrets,
  and confirms the same production record counts after deployment. Do not use
  the first-release command to update an established production store.
  Its secret preflight uses Wrangler's `--format json` output supported by the
  pinned Wrangler 4 CLI.
- Production manager builds set `HALEY_WALI_PRODUCTION_BUILD=1`, which disables
  Vite's local `.env` loading so development passwords and localhost origins are
  never uploaded or baked into the Cloudflare Worker.
- Store secrets in the hosting environment, never in source control.
- Build and test the exact source before deploying.
- The user must approve connecting the domain and any public admin exposure.
- Before production, add owner authentication, restrict admin API access/CORS,
  implement stock reservation/decrement, live-test the free WhatsApp
  confirmation link, and verify the supplier media permission.
