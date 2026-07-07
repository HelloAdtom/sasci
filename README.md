# SASCI — Fund Governance ERP

**Scheme-to-Release Financial Governance Lifecycle** — a full-stack prototype for government capital investment scheme administration (Bank of Maharashtra / state government context).

## Quick Start

Needs a local Postgres — the easiest way is Docker:

```bash
docker compose up -d          # starts Postgres on localhost:5432
cp backend/.env.example backend/.env
npm install
npm run db:push
npm run db:seed
npm run dev
```

No Docker? Point `DATABASE_URL` in `backend/.env` at any Postgres instance instead (a local install, or the external connection string from your Render Postgres — see Deployment below).

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001

## Demo Credentials

All accounts use password `password123` and OTP `123456`.

| Role | Employee Code |
|------|---------------|
| State PMU Admin | PMU-MH-00001 |
| Department Officer | DOE-MH-04471 |
| Field Officer (Maker) | FO-MH-10234 |
| Checker | CHK-MH-20001 |
| Finance Officer | FIN-MH-30001 |
| Approver | APP-MH-40001 |
| Auditor | AUD-MH-50001 |
| System Admin | ADM-MH-90001 |

## 8-Step Demo Flow

1. Login as **PMU-MH-00001** → Executive Dashboard
2. Create a Scheme → test ceiling validation blocking over-allocation
3. Login as **DOE-MH-04471** → create Project with balance validation
4. Create Work Item exceeding project cost → blocked
5. Login as **FO-MH-10234** → submit geo-tagged progress → see eligible demand
6. Raise Fund Demand → Checker → Finance → Approver → **Released**
7. Wallet Ledger updates live
8. Login as **AUD-MH-50001** → full immutable audit trail

## Stack

- **Frontend:** React 19 + Vite + Recharts
- **Backend:** Express 5 + TypeScript
- **Database:** PostgreSQL (Prisma ORM)

## Business Rules Enforced (API layer)

- Scheme ceiling validation on department allocations
- Department balance check on project sanction
- Work item cost vs project approved cost
- Progress-based eligible demand calculation
- Maker → Checker → Finance → Approver workflow (no bypass, no self-approval)
- Geo-tag + photo mandatory on progress submission
- Append-only audit logging on all state changes

## Deployment

**Backend → Render** (`render.yaml` at repo root defines this as a Blueprint — a free Postgres instance plus the API service, wired together automatically):

1. On [render.com](https://render.com): **New → Blueprint**, pick this GitHub repo. Render reads `render.yaml`, provisions the `sasci-db` Postgres instance and the `sasci-backend` web service, and wires `DATABASE_URL` between them automatically.
2. First deploy's build step runs `prisma db push`, which creates the schema on the fresh database. Seed it once (Render dashboard → your service → **Shell**):
   ```bash
   npm run db:seed
   ```
   Don't add seeding to the build command — it would wipe real data on every redeploy.
3. Note the service's public URL (Render → service page, top of the page — typically `https://sasci-backend.onrender.com`, but Render appends a suffix if that name is taken).

**Frontend → Vercel:**

1. On [vercel.com](https://vercel.com): **New Project**, pick this repo, set **Root Directory** to `frontend`.
2. `frontend/vercel.json` rewrites `/api/*` and `/uploads/*` to the Render backend URL from step 3 above. If your Render URL differs from `sasci-backend.onrender.com`, edit both `destination` values in `frontend/vercel.json` before (or after, then redeploy) this step.
3. Deploy. The frontend calls same-origin `/api/...`, which Vercel transparently proxies to Render — no CORS or env-var wiring needed on the frontend.

Free-tier notes: Render's free web services spin down after inactivity (first request after idle takes ~30–60s to wake up), and the free Postgres instance expires after 30 days unless upgraded. Fine for a demo; upgrade both if this needs to stay up permanently.
