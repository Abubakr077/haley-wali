# Haley Wali project context

This folder is the starting point for any developer or LLM working on Haley
Wali. It records the product decisions, current code shape, life cycles, design
rules, and open work that are easy to lose between conversations.

## Reading order

1. [PRODUCT.md](PRODUCT.md) — business, customers, shop categories, and wording.
2. [CURRENT_STATUS.md](CURRENT_STATUS.md) — what is working now and what remains.
3. [ARCHITECTURE.md](ARCHITECTURE.md) — applications, hosting, and ownership.
4. [USER_FLOWS.md](USER_FLOWS.md) — customer and store-manager life cycles.
5. [DATA_AND_API.md](DATA_AND_API.md) — D1 tables, endpoints, import, and pricing.
6. [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — visual direction, assets, and UI rules.
7. [DEVELOPMENT.md](DEVELOPMENT.md) — local setup, checks, environment, and deploy.
8. [LLM_WORKING_RULES.md](LLM_WORKING_RULES.md) — safe rules for future assistants.

## Source-of-truth rule

The running code is the final source of truth. If these notes and code disagree,
inspect the code, confirm the intended decision with the project owner when it
changes business behaviour, then update both the implementation and this folder.

Update `CURRENT_STATUS.md` after every meaningful module or production release.
Update the other file that owns the changed decision instead of adding the same
information to several files.

Last documentation review: **2026-09-14**.
