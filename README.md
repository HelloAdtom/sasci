# SASCI — Fund Governance ERP

**Scheme-to-Release Financial Governance Lifecycle** — a full-stack prototype for government capital investment scheme administration (Bank of Maharashtra / state government context).

## Quick Start

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

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
- **Database:** SQLite (Prisma ORM) — swap to PostgreSQL by changing `datasource` in `backend/prisma/schema.prisma`

## Business Rules Enforced (API layer)

- Scheme ceiling validation on department allocations
- Department balance check on project sanction
- Work item cost vs project approved cost
- Progress-based eligible demand calculation
- Maker → Checker → Finance → Approver workflow (no bypass, no self-approval)
- Geo-tag + photo mandatory on progress submission
- Append-only audit logging on all state changes
