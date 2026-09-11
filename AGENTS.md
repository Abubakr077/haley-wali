# Haley Wali project instructions

Before changing this project, read `docs/README.md` and the context
files it links to. Treat those files as the shared handoff for Codex, Cursor,
and other coding assistants.

Keep the context documents updated when a change affects the product rules,
architecture, data model, API, user flows, commands, design system, deployment,
or known issues. Do not copy secrets, access tokens, customer details, or live
credentials into documentation.

Preserve the agreed product language: use **article**, **suit**, **Pret**,
**unstitched**, **HW Exclusive**, and **Branded**. Do not call the branded
collection “curated resale.” Keep the upstream supplier name out of the public
customer interface.

Use `main` as the canonical branch. Pull from `origin/main` before new work and
push reviewed commits to trigger the guarded GitHub Actions release. Do not run
the local Cloudflare deployment scripts unless the owner explicitly requests a
recovery deployment.

Do not run automated tests after routine changes. The project owner will ask
when tests or a full verification run are wanted.
