# SASCI Design System

This is the single source of truth for SASCI's visual language and UI conventions. Read this before making any frontend change — it exists so edits (by a human, Cursor, or Claude) stay consistent instead of drifting page by page.

The whole system lives in one stylesheet: `frontend/src/styles/global.css`. There are no CSS modules and no component library — every class below is defined there.

## Visual language

SASCI reads as a **civic/government financial system**, not a consumer SaaS product: navy + gold, serif headings, monospace for anything identifier-like (codes, timestamps, stage names, KPI labels). Keep that register. Don't introduce rounded pill buttons, playful colors, or sans-serif headings — it should look like it belongs next to a treasury ledger, not a startup dashboard.

### Color tokens (`:root` in `global.css`)

| Token | Value | Use |
|---|---|---|
| `--navy` / `--navy2` | `#0b2447` / `#13315c` | Top nav, primary buttons, headline accents |
| `--gold` / `--gold-light` | `#c9a227` / `#e8d58a` | Brand accent, top-nav border, "gold" CTAs, kanban headers |
| `--paper` | `#f6f4ee` | Page background |
| `--card` | `#ffffff` | Card/table surfaces |
| `--ink` / `--ink-soft` | `#1c2430` / `#5a6472` | Primary / secondary text |
| `--green` `--amber` `--red` `--blue` | status semantics | success/healthy, warning/near-limit, danger/blocked, informational |
| `--line` | `#d9d4c5` | Borders, dividers, chart baseline/neutral bars |

Status color meaning is fixed across the whole app — don't reassign these per-page:
- **green** = healthy / passed / released / success
- **amber** = near a limit / warning
- **red** = blocked / over a limit / rejected / failed
- **blue** = informational / in-flight / awaiting action

### Typography

- `--font-serif` (`Source Serif 4`) — all headings (`h1`/`h2`/`h3`, `.page-title`, `.card-title`, `.kpi-value`, `.stage-legend-title`).
- `--font-sans` (`Inter`) — body text, form inputs, table cells.
- `--font-mono` (`IBM Plex Mono`) — anything that reads like a system value: codes (`demandCode`, `employeeCode`), timestamps, status/stage words, KPI labels, pills. Wrap these in `.mono` or rely on the component class already applying it (`.pill`, `.kpi-label`, `.kanban-col-header`).

### Spacing

Use the `--space-1` … `--space-5` scale (4/8/16/24/32px) for any new gaps/padding rather than inventing ad hoc pixel values. Existing components (`.card`, `.kpi-card`, `.form-group`) already follow this scale — match it.

## Component patterns

Reuse these existing classes instead of writing new ad hoc markup:

- **`.card` / `.card-title`** — the standard content container. Every page section lives in one.
- **`.kpi-card`** (+ `.gold`/`.green`/`.amber`/`.red` modifiers) — top-line metrics only. Left border color communicates status; don't add more than 5-6 KPI cards to a `.kpi-grid` or it stops being scannable.
- **`.pill`** (+ color modifier) — single-word status badges in tables/cards. Never use for multi-word freeform text.
- **`.data-table`** — every tabular list. Don't build bespoke `<table>` styling per page.
- **`.kanban` / `.kanban-col` / `.kanban-card`** — stage-based workflows (currently just Fund Workflow). If a future feature needs a pipeline view, reuse this rather than inventing a new board component.
- **`EmptyState`** (`frontend/src/components/EmptyState.tsx`) — **every** list/table/kanban column that can legitimately render zero rows must use this instead of silently rendering nothing. A blank screen looks like a bug even when it's correct behavior — this is a hard rule, not a nice-to-have. Give it a specific, situational message (e.g. "No demands awaiting Checker review right now"), not a generic "No data."
- **Loading vs. empty vs. error are three different states** — don't collapse them. Show `···`/a skeleton while a fetch is in flight, `EmptyState` once loaded with zero rows, and `.alert.error` on a failed fetch. `DashboardPage.tsx`'s `kpisLoaded` flag is the reference pattern.

## Charts

Recharts is the only charting library (already a dependency — don't add another). Conventions:
- Reuse the existing stage-color mapping when a chart touches the wallet-ledger stages: Allocated `--navy2`, Demanded `--blue`, Approved `--amber`, Released `--gold`, Utilised `--green` (see `WalletPage.tsx`'s `STAGE_COLORS`).
- Always wrap in `.chart-wrap` (fixed-height flex container) inside a `.card`, and always show `EmptyState` instead of an empty chart when the underlying array is empty.
- Prefer reusing data a page has already fetched over adding new endpoints — most report/dashboard aggregation already exists in `backend/src/services/businessRules.ts` and the `/api/reports/*` / `/api/dashboard/*` routes.
- Money values always go through `formatCurrency()` from `frontend/src/api/client.ts` (Cr/L/₹ formatting) — never render raw rupee numbers.

## Workflow-specific conventions

- The Maker→Checker→Finance→Approver chain is a real control pattern (standard in Indian banking/PFMS/treasury systems), not bespoke to this app — when explaining it in-product, use the plain one-line descriptions already in `FundWorkflowPage.tsx`'s `STAGE_INFO` map, not jargon.
- Self-approval prevention is a governance feature, not a bug — when it blocks an action, tell the user *why* and *what to do* (switch role), never show the raw backend error string.

## Adding a new page

1. Start from an existing page that's structurally closest (e.g. a new master-data page should look like `SchemesPage.tsx`, a new workflow view should look like `FundWorkflowPage.tsx`).
2. Reuse `.card`, `.data-table`, `.pill`, `EmptyState`, and the loading/empty/error pattern above.
3. Add nav entries in `frontend/src/components/Layout.tsx`'s `NAV_BY_ROLE` and route guards in `frontend/src/App.tsx` — don't create a page that's reachable by URL but not linked from the nav for its intended roles.
4. Any new CSS goes in `global.css`, using existing tokens — don't inline one-off colors or hex values in TSX.
