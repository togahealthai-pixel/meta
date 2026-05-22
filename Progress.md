# Progress.md — Togahh Marketing Automation

Comprehensive snapshot of the project for any future agent or developer. Reading this file alone should provide enough context to continue the work without re-discovery.

**Last updated:** 2026-05-21 (Phase 3c complete; responsive shell + visual polish in progress)

---

## 1. What this project is

**Togahh** is a Meta Ads automation + AI content-generation dashboard. Single Next.js application that combines two surfaces:

1. **Main hub** at `/` — an operator dashboard for competitor analysis, AI ad generation, ad approval, Meta campaign launch & management, reporting, and social media content generation.
2. **Dashboard sub-app** at `/dashboard/*` — email-marketing workflow management (campaign creation, lead scraping, contact cleanup, analytics).

Both surfaces share one shell (`AppShell` + `Sidebar` + `TopBar`), one design system (indigo-600 on warm zinc neutrals, Stripe/Notion-like), one auth path, and one Next.js instance.

**Brand naming:**
- **Togahh** = the product name (use everywhere user-facing).
- **Aumatic / Aumatic AI** = the developer team (acceptable in footers/about, not in primary UI).
- **HealPoint AI** = stale name from an earlier iteration — replace if encountered.

**Repository:**
- Local path: `D:\cmr\backup\Code Zone\Official Projects\Aumantic\meta`
- Git branch: `main`
- Folder name `Aumantic/meta` contains a typo (should be "Aumatic") but is the canonical local path.

---

## 2. Tech stack

| Layer | Tech | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 16.1.6 | App Router, Turbopack |
| UI runtime | React | 19.2.3 | |
| Language | TypeScript | ^5 | `strict: false`, `allowJs: true`; only one file has `// @ts-nocheck` (`src/app/page.tsx`) |
| Styling | Tailwind CSS | 4.2.2 | v4, CSS-first config in `globals.css` via `@theme`; legacy `:root --vars` still consumed by `page.tsx` inline styles |
| Component primitives | Radix UI | various | Shadcn-style wrappers in `src/components/ui/` |
| ORM | Prisma | ^5.10.0 | SQLite provider |
| Database | SQLite | local file `./dev.db` | No `prisma/migrations/` directory — schema applied via `prisma db push` |
| Realtime / storage / Postgres | Supabase | 2.101.1 | Used in parallel by the main hub for ad/content data; separate from Prisma |
| Auth | NextAuth | 4.24.7 | JWT strategy; auth wall is **disabled** in dashboard/layout.tsx |
| Server state | TanStack React Query | 5.28.0 | Used in `/dashboard/*` pages |
| Forms | React Hook Form + Zod + @hookform/resolvers | latest | Used in `/dashboard/campaigns/new` and `/dashboard/scraper` |
| Charts | Recharts | 2.12.2 | Used in `/dashboard/analytics` |
| Icons | lucide-react | 1.8.0 | Used everywhere |
| Date utils | date-fns | 3.3.1 | |
| HTTP | axios | 1.6.7 | Used by some dashboard components alongside native fetch |
| Hashing | bcryptjs | 2.4.3 | Used by `/api/seed` and NextAuth credentials provider |
| Build | next-build + Turbopack | — | 22 routes total, ~10s clean build |

**Dead dependencies in `package.json` (declared, never imported):**
- `zustand`
- `@tanstack/react-query-devtools`

---

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Next.js 16 App                              │
├──────────────────┬───────────────────────┬──────────────────────────────┤
│  /  (main hub)   │  /dashboard/*         │  /login                       │
│  page.tsx        │  workflow management  │  hardcoded-cred login         │
│  10 tabs/sections│  Prisma + React Query │  localStorage session         │
└────────┬─────────┴────────────┬──────────┴───────────────┬──────────────┘
         │                       │                          │
         │ fetch                 │ fetch                    │ localStorage
         ▼                       ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Next.js API routes (22 routes)                    │
└────────┬─────────────────────────────────────┬──────────────────────────┘
         │                                      │
         │                                      ▼
         │                              ┌──────────────────┐
         │                              │  Prisma + SQLite │
         │                              │  (./dev.db)      │
         │                              └──────────────────┘
         ▼
┌──────────────────────────────┬───────────────────────────────────────────┐
│   n8n.srv881198.hstgr.cloud  │   n8n.srv1208919.hstgr.cloud              │
│   (main / dashboard)          │   (social media; hardcoded in            │
│                               │   SocialDash.tsx)                         │
└──────────────────────────────┴───────────────────────────────────────────┘
         │
         ▼ realtime + storage
┌─────────────────────────────────────────────────────────────────────────┐
│              Supabase project (Postgres + Storage)                       │
│              tables: reports_json, status_table, n8n,                    │
│                       your_name_table, your_table_name                   │
│              buckets: AD1, AD2, AD3, AD4, AD5                            │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Meta Graph API v21.0 (graph.facebook.com)                   │
│              Used by /api/meta/* routes for live campaigns               │
└─────────────────────────────────────────────────────────────────────────┘
```

The two databases (SQLite via Prisma and Supabase Postgres) **do not talk to each other**. They serve different surfaces.

---

## 4. Filesystem map

### `src/app/` — pages & API

```
src/app/
├── api/                                Next.js API routes — all TypeScript
│   ├── ads/approve/route.ts            POST → updates "Approved" column in Supabase your_name_table
│   ├── analytics/route.ts              GET  → Prisma analytics aggregation
│   ├── auth/[...nextauth]/route.ts     NextAuth handler
│   ├── campaigns/route.ts              GET/POST campaigns (Prisma + n8n webhook)
│   ├── campaigns/[id]/route.ts         GET/DELETE specific campaign
│   ├── campaigns/approve/route.ts      POST approve/reject campaign → n8n approval webhook
│   ├── cleanup/status/route.ts         GET  cleanup history
│   ├── cleanup/trigger/route.ts        POST trigger n8n cleanup workflow
│   ├── executions/[id]/route.ts        DELETE orphan execution
│   ├── meta/campaign-details/route.ts  GET  Meta campaign + adsets
│   ├── meta/launch/route.ts            POST full Meta ad launch (Campaign → AdSet → Creative → Ad)
│   ├── meta/live-campaigns/route.ts    GET/POST list/create live Meta campaigns
│   ├── meta/locations/route.ts         GET  search Meta geo-locations (countries/cities/regions)
│   ├── meta/reports/route.ts           GET  Meta account + campaign insights
│   ├── meta/status/route.ts            POST update campaign/adset status or delete
│   ├── meta/update/route.ts            POST update campaign and/or adset fields
│   ├── proxy/route.ts                  POST generic URL proxy (⚠ SSRF risk)
│   ├── scraper/route.ts                POST trigger n8n scraper workflow
│   ├── scraper/jobs/route.ts           GET  scraper job history
│   ├── seed/route.ts                   GET  one-time admin user seed (hardcoded creds)
│   ├── trigger-ads/route.ts            POST trigger ad generation (resets status_table, calls n8n)
│   └── trigger-n8n/route.ts            POST action proxy → maps action name to n8n webhook
│
├── dashboard/                          Workflow sub-app (TypeScript + Tailwind, fully migrated)
│   ├── layout.tsx                      Wraps children in AppShell + Sidebar (auth wall disabled)
│   ├── page.tsx                        Overview: stats grid + recent executions + quick actions
│   ├── analytics/page.tsx              Charts: campaigns/month + leads/sheet
│   ├── campaigns/page.tsx              Campaign list + review-and-approve dialog
│   ├── campaigns/new/page.tsx          AI campaign generation form
│   ├── cleanup/page.tsx                Cleanup status + history (Instantly.ai contact cleanup)
│   ├── scraper/page.tsx                Lead scraper form (Apify Google Maps)
│   └── scraper/history/page.tsx        Scraper job history table
│
├── login/page.tsx                      Hardcoded-credential login (TypeScript + Tailwind)
│
├── layout.tsx                          Root layout: Inter font, body bg, Providers wrapper
├── page.tsx                            Main hub (4,400 lines, "use client", @ts-nocheck)
│                                       ├ 10 destinations:
│                                       │   Overview, Ads Analysis, Create Ad, Approval,
│                                       │   Campaign Setup, Running Campaign, Reports,
│                                       │   Social-Dash, Newsletter ↗, Outreach ↗
│                                       ├ Chrome (AppShell + Sidebar + TopBar) — Tailwind
│                                       ├ Toast block at bottom — Tailwind
│                                       └ 8 internal tab JSX blocks — STILL INLINE-STYLED
│
├── globals.css                         Tailwind v4 @theme + legacy :root --vars + animations
├── components.tsx                      Legacy primitives (Tailwind now): Badge, Card, MetricCard,
│                                       SectionTitle, WorkflowStep, EmptyState, Spinner,
│                                       PrimaryButton, SecondaryButton
├── CampaignSetup.tsx                   Meta campaign payload builder (1,061 lines, Tailwind)
├── SocialDash.tsx                      Social media generator + Supabase realtime (486 lines, Tailwind)
├── GeneratorModal.tsx                  Video AI configuration modal (Tailwind)
└── RetryModal.tsx                      Retry-generation modal (Tailwind)
```

### `src/components/` — shared & feature components

```
src/components/
├── layout/                             Shared chrome primitives (Phase 1 additions)
│   ├── app-shell.tsx                   Sidebar + main column wrapper
│   ├── sidebar.tsx                     Configurable sidebar (sections + items)
│   ├── sidebar-nav-item.tsx            Single nav row (handles href, onClick, external, active)
│   ├── top-bar.tsx                     Sticky top bar (title, breadcrumb, search slot, actions)
│   ├── page-header.tsx                 Reusable page title + description + actions
│   └── page-container.tsx              Standard content wrapper (sm/md/lg/full sizes)
│
├── ui/                                 Shadcn-style Tailwind primitives
│   ├── badge.tsx          (variants: default, secondary, destructive, outline, success, warning)
│   ├── button.tsx         (variants: default, destructive, outline, secondary, ghost, link)
│   ├── card.tsx           Card + Header/Title/Description/Content/Footer
│   ├── dialog.tsx         Radix Dialog wrapper
│   ├── empty-state.tsx    Phase 1 addition
│   ├── form.tsx           react-hook-form integration
│   ├── input.tsx
│   ├── label.tsx
│   ├── metric-card.tsx    Phase 1 addition (replaces components.tsx MetricCard)
│   ├── progress.tsx
│   ├── section-title.tsx  Phase 1 addition
│   ├── select.tsx
│   ├── separator.tsx
│   ├── skeleton.tsx
│   ├── spinner.tsx        Phase 1 addition (lucide Loader2-based)
│   ├── status-pill.tsx    Phase 1 addition (Live/Paused/Pending pills with optional pulse)
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── textarea.tsx
│   ├── toast.tsx
│   ├── toaster.tsx
│   ├── use-toast.ts       Hook
│   └── workflow-step.tsx  Phase 1 addition
│
├── dashboard/                          Dashboard sub-app chrome
│   ├── sidebar.tsx                     Thin wrapper around shared Sidebar (sets nav items)
│   ├── header.tsx                      Page header used at top of each dashboard page
│   ├── stats-card.tsx                  Refactored to indigo design
│   └── recent-executions.tsx           Recent workflow executions with delete/reuse
│
├── campaigns/                          ⚠ DEAD CODE — not imported anywhere
│   ├── campaign-form.tsx               Earlier alt implementation, replaced by inline page
│   └── campaign-list.tsx               Earlier alt implementation
│
├── scraper/                            ⚠ DEAD CODE — not imported anywhere
│   ├── scraper-form.tsx                Earlier alt implementation
│   └── scraper-results.tsx             Earlier alt implementation
│
├── cleanup/                            Used by /dashboard/cleanup
│   ├── cleanup-status.tsx              Status card + manual trigger
│   └── cleanup-history.tsx             History table
│
├── analytics/                          Used by /dashboard/analytics
│   ├── campaign-chart.tsx              Recharts bar chart (indigo palette)
│   └── lead-chart.tsx                  Recharts pie chart (indigo gradient)
│
└── providers.tsx                       React Query + Toast providers (mounted in root layout)
```

### `src/lib/` — backend helpers

```
src/lib/
├── auth.ts                             NextAuth credentials provider config
├── prisma.ts                           Singleton Prisma client (avoids dev-server reload leaks)
├── supabase.ts                         Singleton Supabase client (anon key)
├── socialSupabase.ts                   Re-exports `supabase` — kept for legacy SocialDash imports
├── utils.ts                            cn(), formatDate, formatDateTime, formatRelativeTime,
│                                       formatDuration, getStatusColor, formatServiceType, truncate
├── validations.ts                      Zod schemas: campaignSchema, scraperSchema
├── n8n.ts                              Misc n8n helper
└── hooks/useN8nStatus.ts               Subscribes to Supabase realtime on `n8n` table
```

### `src/types/`

```
src/types/                              Shared type definitions used by dashboard components
                                        (Campaign, ScraperJob, CleanupLog interfaces)
```

### `prisma/`

```
prisma/
├── schema.prisma                       SQLite provider; 6 models (see Section 5)
└── seed.ts                             Seeds admin user with bcrypt'd password
```

### Repo root

```
/
├── CLAUDE.md                           Project guide for AI assistants
├── Progress.md                         THIS FILE
├── README.md                           Public-facing project description
├── DOCS.md                             Older feature documentation
├── package.json, package-lock.json
├── next.config.mjs                     `images.remotePatterns` for admin.togahh.com
├── postcss.config.mjs                  @tailwindcss/postcss plugin
├── eslint.config.mjs                   next/core-web-vitals + next/typescript
├── tsconfig.json                       strict:false, allowJs:true, @/* → src/*
├── .env                                NOT in repo — see Section 11 for required vars
└── .gitignore
```

---

## 5. Database

### 5.1 SQLite via Prisma

**Connection:** `DATABASE_URL="file:./dev.db"` (configured in `.env`).
**Migration handling:** No `prisma/migrations/` folder exists. Schema is applied via `prisma db push`. No tracked migration history.

**Models (from `prisma/schema.prisma`):**

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  password      String                    // bcrypt hash
  role          String    @default("CLIENT")  // "CLIENT" | "ADMIN"
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  executions    WorkflowExecution[]
  sessions      Session[]
  @@map("users")
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  sessionToken String   @unique
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("sessions")
}

model WorkflowExecution {
  id              String    @id @default(cuid())
  userId          String
  workflowType    String                  // "CAMPAIGN" | "SCRAPER" | "CLEANUP" | "CAMPAIGN_APPROVAL"
  workflowName    String?
  status          String    @default("PENDING")   // "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED"
  n8nExecutionId  String?
  inputData       String                  // JSON
  outputData      String?                 // JSON
  errorMessage    String?
  startedAt       DateTime?
  completedAt     DateTime?
  duration        Int?                    // ms
  createdAt       DateTime  @default(now())
  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaign        Campaign?
  scraperJob      ScraperJob?
  cleanupLog      CleanupLog?
  @@map("workflow_executions")
}

model Campaign {
  id                 String    @id @default(cuid())
  executionId        String    @unique
  campaignName       String
  serviceType        String
  targetRegion       String
  campaignGoal       String    @default("")
  campaignMessage    String    @default("")
  selectedSheet      String
  totalLeadsSent     Int       @default(0)
  successfulSends    Int       @default(0)
  failedSends        Int       @default(0)
  aiGeneratedContent String?                  // JSON: subject_line, preview_text, body_preview, full_email_body
  status             String    @default("PENDING_APPROVAL")  // "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SENT"
  approvedBy         String?
  approvedAt         DateTime?
  rejectedBy         String?
  rejectedAt         DateTime?
  rejectionReason    String?
  comments           String?
  createdBy          String    @default("")
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  execution          WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  @@map("campaigns")
}

model ScraperJob {
  id            String   @id @default(cuid())
  executionId   String   @unique
  niches        String
  location      String
  maxResults    Int
  totalScraped  Int      @default(0)
  validEmails   Int      @default(0)
  invalidEmails Int      @default(0)
  targetSheet   String
  apifyRunId    String?
  createdAt     DateTime @default(now())
  execution     WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  @@map("scraper_jobs")
}

model CleanupLog {
  id            String   @id @default(cuid())
  executionId   String   @unique
  totalContacts Int
  deletedCount  Int
  triggerType   String                     // "manual" | "scheduled"
  cleanupDate   DateTime @default(now())
  execution     WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  @@map("cleanup_logs")
}
```

**Pattern:** `WorkflowExecution` is the parent record; `Campaign`, `ScraperJob`, `CleanupLog` each have a one-to-one relation via `executionId`. Every workflow run creates one `WorkflowExecution` + one of the child records.

### 5.2 Supabase (PostgreSQL) — used in parallel by the main hub

**Connection:** Anon key via `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**Used by:** `src/app/page.tsx`, `src/app/SocialDash.tsx`, `src/lib/hooks/useN8nStatus.ts`, `src/app/api/trigger-ads/route.ts`, `src/app/api/ads/approve/route.ts`.

**Tables consumed:**

| Table | Read/Write | Purpose | Source |
|---|---|---|---|
| `reports_json` | Realtime + read | n8n posts competitor analysis JSON here; page.tsx subscribes to inserts | `page.tsx` |
| `status_table` | Read (poll) + write | n8n workflow status indicator (id=1 row); polled by hub during ad generation | `page.tsx`, `api/trigger-ads` |
| `n8n` | Realtime + read | n8n status feed (used by SocialDash for "Generating images..." messages) | `SocialDash.tsx`, `hooks/useN8nStatus.ts` |
| `your_name_table` | Read + write | ⚠ Placeholder name. Ad approval data lives here. Should be renamed to something meaningful. | `page.tsx`, `api/ads/approve` |
| `your_table_name` | Read | ⚠ Placeholder name. References in `page.tsx` (lines 171, 278). | `page.tsx` |

**Storage buckets:**
- `AD1`, `AD2`, `AD3`, `AD4`, `AD5` — used by page.tsx for video/image ad assets (default media URL in `CampaignSetup.tsx`: `…/storage/v1/object/AD1/…`).

**URL normalization:** Both `page.tsx` and `CampaignSetup.tsx` contain a `normalizeSupabaseUrl()` helper that re-hosts any Supabase storage URL onto the current `NEXT_PUBLIC_SUPABASE_URL`. This was added because some n8n responses returned URLs from a different Supabase project.

---

## 6. API routes (22 total — every one is TypeScript)

All routes live under `src/app/api/`. Format: `route.ts`.

### 6.1 Auth & seeding

| Route | Method(s) | Auth | Purpose |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | — | NextAuth handler with Credentials provider against Prisma User. JWT strategy, 30-day expiry. |
| `/api/seed` | GET | ⚠ NONE | One-time admin seed. Hardcoded: `admin@togahh.com` / `pass@123` (bcrypt hashed). Should be deleted or env-gated in production. |

### 6.2 Campaign workflow (Prisma + n8n)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/campaigns` | GET | session + fallback userId | List user's campaigns ordered by `createdAt desc`. |
| `/api/campaigns` | POST | session + fallback userId | Creates a `WorkflowExecution + Campaign`, posts to `N8N_CAMPAIGN_WEBHOOK_URL` (130s timeout). n8n returns AI-generated email content which is stored on the Campaign. |
| `/api/campaigns/[id]` | GET | session | Fetch a specific campaign (used by the Reuse flow). |
| `/api/campaigns/[id]` | DELETE | session | Cascades: delete Campaign → execution. |
| `/api/campaigns/approve` | POST | session | Posts decision (`approved`/`rejected`) + comments to `N8N_APPROVAL_WEBHOOK_URL` (120s timeout). On approve, n8n sends emails via Instantly.ai. |

### 6.3 Lead scraper (Prisma + n8n)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/scraper` | POST | session + fallback userId | Creates ScraperJob + WorkflowExecution, posts niches/location/maxResults/targetSheet to `N8N_SCRAPER_WEBHOOK_URL` (310s timeout). n8n uses Apify to scrape Google Maps. |
| `/api/scraper/jobs` | GET | session | Job history with execution status and duration. |

### 6.4 Contact cleanup (Prisma + n8n)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/cleanup/status` | GET | session | Returns `lastCleanup`, `nextScheduled`, `totalDeleted`, `totalRuns`, plus logs array. |
| `/api/cleanup/trigger` | POST | session | Posts to `N8N_CLEANUP_WEBHOOK_URL`. Also resets the status_table row optimistically. |

### 6.5 Analytics

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/analytics` | GET | fallback userId | Aggregates campaigns/leads/cleanups + per-month + per-sheet groupings via Prisma. Drives `/dashboard/analytics`. |

### 6.6 Executions

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/executions/[id]` | DELETE | session | Delete an orphan execution (one without a Campaign/ScraperJob/CleanupLog). |

### 6.7 Meta Graph API integration (all v21.0)

All `/api/meta/*` routes use `META_ACCESS_TOKEN` server-side. **None are authenticated** — anyone reaching them can spend the Meta token. Known security debt.

| Route | Method | Purpose |
|---|---|---|
| `/api/meta/live-campaigns` | GET | List all Meta campaigns under `act_${META_AD_ACCOUNT_ID}` with effective_status. |
| `/api/meta/live-campaigns` | POST | Create a new empty Meta campaign. |
| `/api/meta/campaign-details` | GET `?campaignId=…` | Campaign details + nested ad sets. |
| `/api/meta/reports` | GET | Account-level insights + per-campaign breakdown with nested ad-set & ad insights. Processes `actions[]` to extract `leads` and `linkClicks`. |
| `/api/meta/locations` | GET `?q=…` | Geo search via Meta `adgeolocation` search (used by `CampaignSetup.tsx LocationSearch`). |
| `/api/meta/status` | POST `{ id, status?, action? }` | Update campaign/adset status or delete (`action: "delete"`). |
| `/api/meta/update` | POST `{ campaignId?, campaignData?, adSetId?, adSetData? }` | Update fields on a campaign and/or an ad set. |
| `/api/meta/launch` | POST `{ schema, campaignId? }` | **Full launch pipeline**: upload media (video or image) → fetch Page ID → create campaign → create ad set → create creative → create ad. Returns `{ success, campaignId, adSetId, adId }`. Default budget 5000 (cents), default website `https://togahh.com`. |

### 6.8 Ad approval (Supabase)

| Route | Method | Purpose |
|---|---|---|
| `/api/ads/approve` | POST `{ text, approved, id?, time?, format? }` | Updates the `Approved` column in the Supabase `your_name_table` for a given media URL. Falls back to INSERT if no rows updated (manual upload case). Uses Prisma `$executeRawUnsafe` against the SQLite db — **likely a bug**, the table name suggests Supabase. Worth investigating. |

### 6.9 n8n triggers

| Route | Method | Purpose |
|---|---|---|
| `/api/trigger-ads` | POST `{ report_id, report_data, ads_config }` | Resets `status_table` to "Triggering...", then POSTs to hardcoded `https://n8n.srv881198.hstgr.cloud/webhook/generate_ad`. |
| `/api/trigger-n8n` | POST `{ action, …payload }` | Action → webhook URL map (see Section 7.1). Intentionally wraps non-ok n8n responses as HTTP 200 so the frontend can read the error body. On exception, returns `{ error, isTimeout: true }`. |

### 6.10 Open proxy

| Route | Method | Purpose |
|---|---|---|
| `/api/proxy` | POST `{ url, body?, method? }` | ⚠ **Generic proxy accepts any URL** — SSRF risk. Used by `SocialDash.tsx` for routing to social-side n8n webhooks. Should be replaced with an allowlist or a dedicated route. |

---

## 7. External services & webhooks

### 7.1 Main n8n instance (`n8n.srv881198.hstgr.cloud`)

The hub action proxy `/api/trigger-n8n` maps the `action` field of the request body to one of these hardcoded webhooks:

| Action | URL |
|---|---|
| `competitor_analysis` | `https://n8n.srv881198.hstgr.cloud/webhook/meta_ads_scraper` |
| `generate_ad` | `https://n8n.srv881198.hstgr.cloud/webhook/generate_ad` |
| `launch_meta_ad` | `https://n8n.srv881198.hstgr.cloud/webhook/launch_ad` |
| `stop_campaign` | `https://n8n.srv881198.hstgr.cloud/webhook/stop_campaign` |
| `generate_report` | `https://n8n.srv881198.hstgr.cloud/webhook/generate_report` |
| `generate_social_post` | `https://n8n.srv881198.hstgr.cloud/webhook/social_post` |

`/api/trigger-ads` also hits `https://n8n.srv881198.hstgr.cloud/webhook/generate_ad` directly with a different payload shape.

Dashboard sub-app uses these env-variable webhooks (same domain):

| Env var | Used by |
|---|---|
| `N8N_CAMPAIGN_WEBHOOK_URL` | `/api/campaigns` (POST) |
| `N8N_APPROVAL_WEBHOOK_URL` | `/api/campaigns/approve` |
| `N8N_SCRAPER_WEBHOOK_URL` | `/api/scraper` |
| `N8N_CLEANUP_WEBHOOK_URL` | `/api/cleanup/trigger` |
| `N8N_API_KEY` | Read in `lib/auth.ts` (purpose unclear; may be inherited) |

### 7.2 Social-side n8n instance (`n8n.srv1208919.hstgr.cloud`)

Hardcoded directly in `src/app/SocialDash.tsx`:

| Trigger | Webhook |
|---|---|
| Generate social images (GET) | `https://n8n.srv1208919.hstgr.cloud/webhook/1703fb64-ec58-4e56-9ce7-bd9e16e15220` |
| Manual video trigger | `https://n8n.srv1208919.hstgr.cloud/webhook/289d4090-ac38-4c90-9876-5ca765e46211` |
| Dynamic spotlight (modal submit) | `https://n8n.srv1208919.hstgr.cloud/webhook/7be28969-c4ad-404a-b982-841dda7133af` |
| Accept generated story | `https://n8n.srv1208919.hstgr.cloud/webhook/81f0d39d-6344-421a-b3a2-019b2c737483` |
| Retry generation | `https://n8n.srv1208919.hstgr.cloud/webhook/ddcfb213-9313-46e3-8270-dd603301c1bd` |
| Post video to social | `https://n8n.srv1208919.hstgr.cloud/webhook/8f91f8e3-d06f-4e73-a545-e18065750416` |

These all route through `/api/proxy` (the open proxy) to bypass CORS.

### 7.3 Meta Graph API (graph.facebook.com)

Server-side only. Token in `META_ACCESS_TOKEN`. Ad account ID in `META_AD_ACCOUNT_ID` (also exposed to client as `NEXT_PUBLIC_META_AD_ACCOUNT_ID` for the "Open Ads Manager" link). Page ID in `META_PAGE_ID` (fallback: first page returned by `me/accounts`).

### 7.4 Supabase Realtime channels

| Channel | Table | Used by | Filters |
|---|---|---|---|
| Anonymous channel | `reports_json` | `page.tsx` | event `*`, schema `public` |
| `n8n-status-changes` | `n8n` | `SocialDash.tsx`, `useN8nStatus` | `n8n.srv1208919` flow updates |

### 7.5 n8n competitor-analysis response shape

n8n returns these top-level keys (don't rename — `page.tsx` expects them with optional chaining):

```
executive_summary, competitor_analysis, gap_opportunities,
ready_ad_scripts, action_plan, hook_analysis,
market_insights, budget_recommendation
```

There are also legacy table-shaped fields used by older render paths:
`competitors_table`, `hooks_table`, `market_insights_table`, `gaps_table`

Always access via `analysisData?.field || []`.

---

## 8. Auth flows (three coexisting paths)

⚠ **Auth is messy.** Three separate mechanisms run in parallel; none is fully wired up. Treat as known tech debt.

### 8.1 NextAuth (JWT)

- Endpoint: `/api/auth/[...nextauth]`
- Provider: Credentials (email + bcrypt password against Prisma `User` table)
- Strategy: JWT, 30-day expiry
- Used by: the `/dashboard/*` API routes via `getServerSession(authOptions)`
- ⚠ **The login wall is commented out** in `src/app/dashboard/layout.tsx` ("Removed login wall as requested"). `/dashboard/*` routes are reachable without a session.
- Fallback userId hardcoded in several routes: `"cmo8ubhgi0000difwp4jsua3t"`.

### 8.2 Hardcoded credentials in `/login/page.tsx`

- Hardcoded `targetEmail = "togahealthai@gmail.com"` and `targetPass = "Meta123.com"`.
- On success: `localStorage.setItem("toga_auth_session", "true")` + email, then `router.push("/")`.
- Used by: the main hub `/` (which checks `localStorage.toga_auth_session` to gate UI).
- ⚠ Bypasses NextAuth entirely. The credential is in plaintext in source.

### 8.3 Seed route

- `/api/seed` GET creates an admin user via Prisma with hardcoded credentials `admin@togahh.com` / `pass@123` (bcrypt hashed before insert).
- ⚠ No auth on the route — anyone can hit it.

---

## 9. Frontend styling system

### 9.1 Design tokens

Live in `src/app/globals.css`:

- **Two layers coexist:**
  - **Tailwind v4 `@theme`** (preferred): semantic tokens (`--color-primary`, `--color-background`, etc.) and color scales (indigo, blue, zinc, slate, gray). Consumed by Tailwind utility classes everywhere and by all `src/components/ui/*` primitives.
  - **Legacy `:root --vars`** (still needed): `var(--primary)`, `var(--card-bg)`, `var(--radius-lg)`, etc. Still consumed by inline `style={{...}}` blocks inside `src/app/page.tsx`. Both layers hold the same indigo + zinc color values for visual consistency.

- **Primary accent:** `#4F46E5` (Tailwind indigo-600).
- **Neutrals:** Tailwind zinc scale.
- **Font:** Inter (loaded via `next/font/google`, CSS var `--font-inter`).
- **Radii:** 4/6/8/12/16/20px (`rounded-xs/sm/md/lg/xl/2xl`).
- **Shadows:** Stripe-style, defined as `--shadow-xs/sm/md/lg/xl` in both layers.

### 9.2 Animations

Custom keyframes in `globals.css`: `fadeIn`, `slideUp`, `slideDown`, `scaleIn`, `spin`, `pulse`, `slideInRight`, `shimmer`, `scan`, `shake`. Exposed as classes: `animate-fade-in`, `animate-slide-up`, `animate-slide-down`, `animate-scale-in`, `animate-pulse`, `animate-spin`, `animate-toast`, `animate-shake`.

### 9.3 Path alias

`@/*` → `src/*` (set in `tsconfig.json`).

---

## 10. NPM scripts & commands

```bash
npm run dev          # Next.js dev server (port 3000 by default, Turbopack)
npm run build        # Production build (TypeScript pass included)
npm run start        # Production server
npm run lint         # ESLint

npx prisma generate  # Regenerate Prisma client (runs automatically as postinstall)
npx prisma db push   # Apply schema to ./dev.db (no migration file)
npx prisma studio    # Visual DB inspector
npx prisma db seed   # Run prisma/seed.ts (seeds admin user)
```

---

## 11. Environment variables (no values, names only — see `.env`)

```ini
# Database (Prisma + SQLite)
DATABASE_URL                            # e.g. file:./dev.db

# Supabase (anon — used client-side and server-side)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# Supabase social-dash project (may be unused now — socialSupabase.ts re-exports main)
NEXT_PUBLIC_SOCIAL_DASH_SUPABASE_URL
NEXT_PUBLIC_SOCIAL_DASH_SUPABASE_ANON_KEY

# Meta Graph API
META_ACCESS_TOKEN
META_AD_ACCOUNT_ID
NEXT_PUBLIC_META_AD_ACCOUNT_ID         # exposed to client for "Open Ads Manager" link
META_PAGE_ID

# n8n (dashboard sub-app)
N8N_CAMPAIGN_WEBHOOK_URL
N8N_APPROVAL_WEBHOOK_URL
N8N_SCRAPER_WEBHOOK_URL
N8N_CLEANUP_WEBHOOK_URL
N8N_API_KEY

# NextAuth
NEXTAUTH_URL
NEXTAUTH_SECRET
```

The main-hub n8n webhooks and social-dash n8n webhooks are **hardcoded in source**, not env-driven.

---

## 12. Migration history (chronological)

This is the full history of UI/architecture work across multiple sessions. Each phase was build-verified.

### Phase 1 — Design system + shared layout + login

- Refreshed `globals.css` design tokens to indigo-600 + zinc + Stripe-style shadows. Kept legacy `--vars` in `:root` aligned to the same colors.
- Built new shared layout primitives in `src/components/layout/`: `app-shell.tsx`, `sidebar.tsx`, `sidebar-nav-item.tsx`, `top-bar.tsx`, `page-header.tsx`, `page-container.tsx`.
- Built new UI primitives in `src/components/ui/`: `metric-card.tsx`, `section-title.tsx`, `empty-state.tsx`, `spinner.tsx`, `status-pill.tsx`, `workflow-step.tsx`.
- Converted `src/app/layout.js` → `layout.tsx`; brand title set to "Togahh — Meta Ads & Content Automation".
- Rebuilt `src/app/login/page.tsx` with Tailwind, modern light SaaS aesthetic. Auth logic verbatim preserved (hardcoded creds, localStorage flag).
- Deleted `src/app/login.css`.
- Rewrote `CLAUDE.md`.

### Phase 2 — Dashboard sub-app polish

- `src/app/dashboard/layout.tsx` adopted `AppShell`.
- `src/components/dashboard/sidebar.tsx` rewritten as thin wrapper around shared `Sidebar` (the dark slate sidebar is gone).
- Refreshed `header.tsx`, `stats-card.tsx`, `recent-executions.tsx` to match new design.
- Polished all `/dashboard/*` pages — swapped `#0077b6` cyan-blue accents to indigo throughout.
- Updated `campaign-chart.tsx` + `lead-chart.tsx` recharts palette to indigo gradient.

### Phase 3a — All hub JS files renamed to TSX

- `src/app/page.js` → `page.tsx` (4,363 lines)
- `src/app/CampaignSetup.js` → `CampaignSetup.tsx` (1,061 lines)
- `src/app/SocialDash.js` → `SocialDash.tsx` (486 lines)
- `src/app/GeneratorModal.js` → `GeneratorModal.tsx`
- `src/app/RetryModal.js` → `RetryModal.tsx`
- `src/app/components.js` → `components.tsx`
- Small files typed properly with `: any` on legacy destructured props.
- Three large files (page, CampaignSetup, SocialDash) carried `// @ts-nocheck` initially.

### Phase 3b — Main hub adopted AppShell

- `src/app/page.tsx` chrome (top header + tab-strip) replaced with shared `AppShell` + `Sidebar` + `TopBar`.
- Sidebar nav items wired to existing `setTab()` callbacks; Newsletter/Outreach are external links.
- Sign in/out + user chip moved to the TopBar `actions` slot.
- TopBar title reflects current tab dynamically via `TABS.find(t => t.id === tab)?.label`.

### Phase 3c (in progress) — Tailwind for hub files

Completed:
- `src/app/components.tsx` — fully Tailwind, properly typed, `@ts-nocheck` removed. Dynamic-color props (Badge, MetricCard) still use inline `style` for caller-supplied hex.
- `src/app/RetryModal.tsx` — fully Tailwind, properly typed.
- `src/app/GeneratorModal.tsx` — fully Tailwind, properly typed.
- `src/app/SocialDash.tsx` — fully Tailwind, properly typed, `@ts-nocheck` removed. `socialSupabase` realtime + n8n webhooks preserved verbatim.
- `src/app/CampaignSetup.tsx` — fully Tailwind, properly typed, `@ts-nocheck` removed. Internal helpers (`Row`, `FieldGroup`, `LocationSearch`) all typed. Launch state machine, geo-targeting payload builder, live-campaign list, the iPhone-style ad preview — all preserved.
- `src/app/social-dash.css` — **deleted** (no longer referenced).
- `src/app/page.tsx` toast block at the bottom — converted to Tailwind.
- `src/app/page.tsx` imports cleaned (removed unused `Bell`, `Settings`, and redundant `globals.css` import).

### Backend TypeScript migration

All 13 backend `.js` files converted to `.ts`:
- `src/lib/supabase.js` → `supabase.ts`
- `src/lib/socialSupabase.js` → `socialSupabase.ts`
- `src/lib/hooks/useN8nStatus.js` → `useN8nStatus.ts`
- All 10 API route handlers (`route.js` → `route.ts`):
  `ads/approve`, `proxy`, `trigger-ads`, `trigger-n8n`,
  `meta/locations`, `meta/status`, `meta/update`,
  `meta/campaign-details`, `meta/launch`, `meta/reports`

Each conversion added proper interfaces for request/response shapes and replaced unchecked `error.message` with `error instanceof Error` guards.

### Finalization sweeps

- Replaced all `rgba(37, 99, 235, …)` (old blue-600 shadows) with `rgba(79, 70, 229, …)` (indigo-600).
- Replaced `"HealPoint Health"` DSA-beneficiary fallback with `"Togahh"`.
- Removed `outreach_temp` from `tsconfig.json` exclude list (directory didn't exist).
- Deleted tracked junk files: `test_geo.js`, `debug.txt`, `indore_response.json`.

---

## 13. Current state — what works, what doesn't

### Working & verified

- ✅ Production build passes (`npm run build` → exit code 0)
- ✅ 22 routes compile (1 static `/`, 1 static `/_not-found`, 1 static `/login`, 19 dynamic API/dashboard routes)
- ✅ All `.js` / `.jsx` source files eliminated — entire `src/` is `.ts` / `.tsx`
- ✅ All 6 hub files are 100% Tailwind (components, RetryModal, GeneratorModal, SocialDash, CampaignSetup, **page.tsx**)
- ✅ Login, /dashboard, main-hub chrome, all 8 tabs, ad-details modal, reports modal, edit modal, and toasts are all Tailwind
- ✅ Brand standardized to "Togahh"
- ✅ Indigo-600 design system applied consistently
- ✅ Build/dev server boots and renders all routes
- ✅ **Legacy `:root --vars` block deleted from `globals.css`** — Tailwind `@theme` is now the single source of truth
- ✅ **Inline-style blocks: 456 → 3** in `page.tsx` (the 3 remaining are legitimate dynamic CSS animations: `scan`, `fillImageGen`, `fillVideoGen`)
- ✅ Dead `tabStyle()` helper removed from `page.tsx`
- ✅ **Universal CSS reset removed from `globals.css`** — a leftover `*, *::before, *::after { margin: 0; padding: 0 }` rule was overriding every Tailwind padding/margin utility. Tailwind v4 preflight handles this correctly on its own.
- ✅ **Responsive shell:** mobile (`< 768px`) shows a "Desktop required" blocker; tablet (`768–1023px`) collapses the sidebar into a hamburger-triggered drawer with backdrop and ESC-equivalent backdrop click; desktop (`≥ 1024px`) shows the static sidebar. Implemented via `SidebarContext` in `src/components/layout/app-shell.tsx`; `TopBar` and `SidebarNavItem` consume it. Nav-item clicks auto-close the drawer on tablet.
- ✅ **Visual redesign in progress** — Overview and Approval tabs now use a refined modern-SaaS aesthetic: dedicated page subtitle bars, KPI cards with icon chips + tabular-nums + hover lift, divided-grid metric panels, icon-led section headers, polished empty states. Remaining tabs (Reports, Running Campaign, Ads Analysis, Create Ad) and the modals + delegated components (CampaignSetup, SocialDash, GeneratorModal, RetryModal) still use the earlier "functional Tailwind" pass — they work but lack the polish.

### Remaining work (out of scope for styling migration)

**1. `// @ts-nocheck` still on `page.tsx`.** Removing it surfaces ~40 pre-existing type errors from untyped `useState({})` hooks and from `EmptyState`'s `description` vs `sub` prop mismatch. These were silenced — not introduced — by `@ts-nocheck`. Fixing them requires:
  - Typing ~83 `useState` calls (e.g. `useState<{ campaignId: string; campaignData: any }>({})`)
  - Renaming `<EmptyState description=…>` callers to `<EmptyState sub=…>` (or extending `EmptyStateProps` to accept both)
  - Fixing `quickActions` array typing inside Overview tab so React infers the click handler/icon/label tuple correctly

**2. `src/app/components.tsx` still exists.** It's now 100% Tailwind but is still imported by `page.tsx`, `CampaignSetup.tsx`, and `SocialDash.tsx`. Replacing the imports with `src/components/ui/*` equivalents is a separate task — the APIs differ:
  - `Badge` here takes `color`/`bg` hex strings; the ui version takes a `variant` enum
  - `Card` here is a `<div>` wrapper; the ui version has Header/Title/Description/Content/Footer subcomponents
  - `MetricCard`/`SectionTitle`/`WorkflowStep`/`EmptyState`/`Spinner`/`SecondaryButton` all have wider feature surface in ui versions
  - Either migrate all callers (~50 usages) to the ui equivalents, or fold the legacy variants into `src/components/ui/*` as additional variants.

---

## 14. Known issues & tech debt (out of scope for UI migration)

### Security

- **Open proxy** at `/api/proxy` accepts any URL → SSRF risk. Add an allowlist or replace with dedicated routes.
- **All `/api/meta/*` routes are unauthenticated.** Anyone reaching them can spend the Meta access token.
- **Hardcoded admin credentials** in `src/app/login/page.tsx` (`togahealthai@gmail.com` / `Meta123.com`).
- **Hardcoded seed credentials** in `/api/seed` (`admin@togahh.com` / `pass@123`). Route is also unauthenticated.
- **Auth wall disabled** in `src/app/dashboard/layout.tsx` ("Removed login wall as requested").
- **Fallback userId** `cmo8ubhgi0000difwp4jsua3t` is hardcoded in several API routes — anyone hitting these routes gets that user's data.

### Data layer

- **Placeholder Supabase table names** `your_name_table` and `your_table_name` still in `page.tsx` and `/api/ads/approve`. Look like copy-paste artifacts — rename to real table names.
- **No `prisma/migrations/`** directory — schema is applied via `prisma db push`, no migration history is tracked. Deployment is brittle.
- **`/api/ads/approve` uses `prisma.$executeRawUnsafe`** to query Supabase-named tables — likely a bug. Investigate.

### Codebase hygiene

- **Dead npm dependencies**: `zustand`, `@tanstack/react-query-devtools` declared but never imported.
- **Dead components**: `src/components/campaigns/campaign-form.tsx`, `campaign-list.tsx`, `src/components/scraper/scraper-form.tsx`, `scraper-results.tsx` exist but nothing imports them.
- **`src/lib/socialSupabase.ts`** just re-exports the main Supabase client; the alias is no longer needed.
- **No tests anywhere.** No jest/vitest/playwright configs, no `*.test.*` files.
- **No CI configs** in the repo root.

### Behavior quirks

- `/api/trigger-n8n` intentionally wraps non-ok n8n responses in HTTP 200 so the frontend's catch block doesn't throw. The frontend should check `data.error` instead of `res.ok`.
- Main hub polls `status_table.id=1` every 3 seconds during ad generation instead of subscribing to a callback.
- Newsletter & Outreach are **not in this repo** — they're external Vercel deployments linked from the sidebar:
  - `https://newsletter-omega-eight.vercel.app/newsletter/generate`
  - `https://outreach-umber.vercel.app`

---

## 15. How to continue from this point (recommended next sessions)

Phase 3c styling migration is complete. Active workstream is **Phase 4: visual redesign** — applying modern light-SaaS polish tab-by-tab. Done so far: Overview, Approval. Pending in order:

| # | Target | Notes |
|---|---|---|
| 1 | **Reports tab + modal** | KPI cards, campaign table, creatives modal |
| 2 | **Running Campaign + edit modal** | Nested expandable cards (campaign → adset → ad) |
| 3 | **Ads Analysis tab** | History sidebar, workflow stepper, results tables |
| 4 | **Create Ad tab** | Largest — multi-step config, progress states, ad previews |
| 5 | **Ad Details modal** | 2-column inspector with edit/retry overlay |
| 6 | **CampaignSetup component** | Standalone file, 1,061 lines |
| 7 | **SocialDash component** | Standalone file, 486 lines |
| 8 | **GeneratorModal + RetryModal** | Small auxiliary modals |

After Phase 4, other options remain:

**Option A — Finish typing `page.tsx`** (remove `@ts-nocheck`):
1. Run `npx tsc --noEmit` to see the ~40 remaining type errors
2. Fix `useState({})` → `useState<{...}>({})` with proper interfaces
3. Reconcile `EmptyState` props (`description` vs `sub`)
4. Remove the `@ts-nocheck` line

**Option B — Consolidate `components.tsx` into `src/components/ui/*`:**
1. Audit each primitive's API differences (see Section 13)
2. Either extend ui primitives or migrate all ~50 callers
3. Delete `src/app/components.tsx`

**Option C — Tackle non-UI tech debt** (Section 14): security holes in `/api/proxy` and `/api/meta/*`, placeholder Supabase table names, dead npm dependencies, etc.

**Legacy reference — Phase 3c progress (now complete):**

**Suggested commands a fresh agent should run first:**

```bash
# Confirm clean baseline
npm run build

# Look at current file sizes for context
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -n | tail -20

# Inventory remaining inline styles
grep -c "style={{" src/app/page.tsx
```

**Workflow for each tab conversion sub-batch:**

1. Read the tab section of `page.tsx` (use the line ranges from Section 13).
2. Replace each `style={{...}}` block with equivalent Tailwind classes.
3. Replace `var(--xxx)` references with Tailwind colors (mapping: `--primary` → `indigo-600`, `--text` → `zinc-900`, `--text-muted` → `zinc-500`, `--border` → `zinc-200`, etc. — full map in `globals.css`).
4. Preserve every `useState` reference, every event handler, every `setTab()` call, every conditional render.
5. `npx tsc --noEmit && npm run build` → must pass before claiming done.
6. (Ideally) visually verify the tab in dev server.

**When ALL 8 tabs done:** delete `src/app/components.tsx`, remove the `:root --vars` block in `globals.css`, remove `// @ts-nocheck` from top of `page.tsx`. Final build verify.

---

## 16. Quick reference

**Brand:** Togahh
**Primary accent:** Indigo-600 (`#4F46E5`)
**Font:** Inter
**Path alias:** `@/*` → `src/*`
**Hub login (hardcoded):** `togahealthai@gmail.com` / `Meta123.com`
**Dashboard seed admin:** `admin@togahh.com` / `pass@123`
**Dev URL:** `http://localhost:3000`
**Main n8n host:** `n8n.srv881198.hstgr.cloud`
**Social n8n host:** `n8n.srv1208919.hstgr.cloud`
**Total routes:** 22
**Total source files:** ~70 (all `.ts`/`.tsx`)
**Outstanding inline-style blocks:** ~456 (all in `src/app/page.tsx`)
