# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint

npx prisma db push       # Push schema changes (no migration history is tracked yet)
npx prisma studio        # Open DB GUI
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db seed       # Run prisma/seed.ts to seed an admin user
```

## Architecture

### Two surfaces in one Next.js app

1. **Main hub** (`src/app/page.tsx`) — A single large client component (~4,400 lines) at `/`. It owns a 10-destination layout (Overview, Ads Analysis, Create Ad, Approval, Campaign Setup, Running Campaign, Reports, Social-Dash, Newsletter, Outreach). All tab state lives in flat React `useState` hooks inside this one file. Newsletter and Outreach are **external links** to separate Vercel deployments (`newsletter-omega-eight.vercel.app`, `outreach-umber.vercel.app`) — they are not in this repo. The hub is wrapped in the shared `AppShell` + `Sidebar` + `TopBar` primitives; nav items call the existing `setTab()` dispatch.

2. **Dashboard sub-app** (`src/app/dashboard/`) — Next.js App Router section for workflow management (Campaigns, Lead Scraper, Scraper History, Cleanup, Analytics). Server components + Prisma for data fetching. Wraps children in the same shared `AppShell`.

3. **Login page** (`src/app/login/page.tsx`) — Hardcoded-credential check sets `localStorage.toga_auth_session`. Tailwind-styled, indigo accent.

### Styling — unified Tailwind + TypeScript

The frontend is on a single **Tailwind CSS + TypeScript** stack. Every UI file is `.tsx`. The light-SaaS aesthetic (Stripe/Notion-like) uses indigo-600 as the primary accent on warm zinc neutrals.

**Migration status:**
- **Phase 1 (done):** Design system tokens, shared layout primitives, login rebuilt.
- **Phase 2 (done):** `/dashboard` sub-app polished against the new design system; shared `AppShell` adopted.
- **Phase 3a (done):** All six legacy hub `.js` files renamed to `.tsx` (page, CampaignSetup, SocialDash, GeneratorModal, RetryModal, components).
- **Phase 3b (done):** Main hub adopted `AppShell` + `Sidebar` + `TopBar`. Old top tab-strip and hero header replaced. Sign in/out moved into the TopBar actions slot.
- **Phase 3c (done in part):** Inline-styles → Tailwind for `components.tsx`, `RetryModal.tsx`, `GeneratorModal.tsx`, `SocialDash.tsx`, `CampaignSetup.tsx`, plus the toast block at the bottom of `page.tsx`. The `src/app/social-dash.css` file was deleted. These 5 files are now fully typed (no `@ts-nocheck`) and contain zero `var(--xxx)` references.
- **Phase 3d (remaining):** The 8 tab JSX blocks inside `page.tsx` (~4,000 lines of inline-styled JSX) still need to be converted to Tailwind. `page.tsx` retains the `// @ts-nocheck` at the top until the conversion is finished. Suggested order: Overview → Reports → Running Campaign → Approval → Create Ad → Ads Analysis → Campaign Setup → Social-Dash. As each tab is converted, drop its inline styles and replace `components.tsx` primitives with `src/components/ui/*`. When the last tab is migrated, `src/app/components.tsx` and the legacy `:root --vars` block in `globals.css` can be deleted.

**Where things live:**

- **Design tokens** — `src/app/globals.css`. Two layers coexist:
  - **Tailwind v4 `@theme`** — semantic tokens (`--color-primary`, `--color-background`, etc.) and color scales (indigo, blue, zinc, slate, gray) consumed by Tailwind utility classes and `src/components/ui/*` shadcn primitives.
  - **Legacy `:root --vars`** — `var(--primary)`, `var(--card-bg)`, `var(--radius-lg)`, etc. Still consumed by inline styles inside `page.tsx`, `CampaignSetup.tsx`, `SocialDash.tsx`, and `components.tsx`. They share the same indigo color values as the Tailwind tokens, so the visual treatment is consistent across both halves. Will be removed when Phase 3c finishes.

- **Tailwind UI primitives** — `src/components/ui/` (shadcn-style):
  `badge`, `button`, `card`, `dialog`, `empty-state`, `form`, `input`, `label`, `metric-card`, `progress`, `section-title`, `select`, `separator`, `skeleton`, `spinner`, `status-pill`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `workflow-step`.

- **Shared layout primitives** — `src/components/layout/`:
  `app-shell.tsx`, `sidebar.tsx`, `sidebar-nav-item.tsx`, `top-bar.tsx`, `page-header.tsx`, `page-container.tsx`.

- **Legacy inline-style primitives** — `src/app/components.tsx`. Used by `page.tsx`, `CampaignSetup.tsx`, `SocialDash.tsx`. Will be deleted once those callers migrate. **Do not add to it** — write Tailwind versions in `src/components/ui/` instead.

**Rules:**
- New code is **TypeScript + Tailwind**. Use the `@/` path alias and components from `src/components/ui` and `src/components/layout`.
- The brand name across the app is **Togahh**. "Aumatic AI" is the developer team, not a product name.
- Behavior preservation is a hard rule when touching legacy hub files — no logic changes, no added/removed features beyond what's explicitly requested.

### Data Flow

```
Frontend (page.tsx)
  → /api/trigger-n8n  (CORS proxy)
  → n8n cloud webhooks (srv881198.hstgr.cloud)
  → n8n POSTs results back via Supabase realtime

Frontend (/dashboard/*)
  → /api/campaigns, /api/scraper, /api/cleanup  (Next.js API routes)
  → Prisma → SQLite (local file: ./dev.db)
  → n8n webhooks (via server-side fetch with env vars)
```

The main `page.tsx` reads live data from **two Supabase projects** (these are still Postgres-on-Supabase — only the Prisma side moved to SQLite):
- Main: `NEXT_PUBLIC_SUPABASE_URL` — used for reports, ad data (`src/lib/supabase.js`)
- Social-Dash: `NEXT_PUBLIC_SOCIAL_DASH_SUPABASE_URL` — used for `SocialDash.tsx` (`src/lib/socialSupabase.js`, which currently just re-exports the main client)

### Auth

NextAuth JWT strategy at `/api/auth/[...nextauth]`. Credentials (email + bcrypt password) stored in Prisma `User` table. The dashboard layout has the login wall **commented out** — all `/dashboard/*` routes are currently unprotected. Fallback userId `"cmo8ubhgi0000difwp4jsua3t"` is hardcoded in several API routes for dev. The main hub (`/`) and the rebuilt `/login` page use a separate hardcoded-credential check that sets `localStorage.toga_auth_session` — this bypasses NextAuth entirely.

### n8n Integration

Two separate n8n instances are used:
- `n8n.srv881198.hstgr.cloud` — Meta ads, campaigns, scraper, cleanup (server-side via env vars; also hardcoded in `/api/trigger-ads` and `/api/trigger-n8n`)
- `n8n.srv1208919.hstgr.cloud` — Social media / SocialDash (hardcoded in `SocialDash.tsx`)

The `/api/trigger-n8n/route.js` acts as a CORS proxy; it intentionally wraps non-ok responses as 200 so the frontend can read the error body.

n8n response data from competitor analysis uses these exact field names (do not rename):
`executive_summary`, `competitor_analysis`, `gap_opportunities`, `ready_ad_scripts`, `action_plan`, `hook_analysis`, `market_insights`, `budget_recommendation`. Always access with optional chaining and `|| []` fallbacks.

### Key Path Alias

`@/*` resolves to `src/*` (configured in `tsconfig.json`). Use this in all TS/TSX files.

### Database

**SQLite** via Prisma (`provider = "sqlite"` in `prisma/schema.prisma`). Connection string: `DATABASE_URL="file:./dev.db"`. No `prisma/migrations/` directory exists yet — schema is applied with `prisma db push` rather than tracked migrations.

Models: `User`, `Session`, `WorkflowExecution`, `Campaign`, `ScraperJob`, `CleanupLog`. `WorkflowExecution` is the parent record; `Campaign`, `ScraperJob`, and `CleanupLog` each have a one-to-one relation to it via `executionId`.

Supabase (PostgreSQL) is used in parallel for ad/content data (tables: `reports_json`, `status_table`, plus literal placeholder names `your_name_table`/`your_table_name` in `page.tsx`). The two databases do not talk to each other.

### Open known-issues to clean up

These were surfaced during the migration but parked as out-of-scope (no behavior change). Tackle when time permits:

- **Phase 3c** — finish migrating the 8 hub tab contents from inline styles to Tailwind (see Migration status above).
- **Dead npm dependencies** — `zustand` and `@tanstack/react-query-devtools` are in `package.json` but never imported. Remove them when next running `npm install`.
- **Placeholder Supabase table names** — `your_name_table` / `your_table_name` are still referenced in `page.tsx` and `/api/ads/approve/route.js`. They look like copy-paste artifacts. Verify what the real table should be and rename.
- **Open `/api/proxy`** — accepts arbitrary URLs (SSRF risk). Add a host allowlist or remove if unused.
- **Unauthenticated `/api/meta/*` routes** — anyone reaching them can spend the Meta access token. Add auth.
- **Hardcoded admin credentials** in `src/app/login/page.tsx` and `/api/seed/route.js`. Move to env or a real auth flow.
