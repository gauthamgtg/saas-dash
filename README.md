# Ledger — Revenue Terminal

Client-first SaaS revenue analytics with optional cloud (Trust pages, Stripe sync, file storage, live peer benchmarks).

## Quick start

```bash
npm install
cp .env.example .env.local   # optional cloud config
npm run dev
```

Open http://localhost:3000 — upload a payments CSV (or try sample data).

## Cloud features (Workspace)

In **Workspace & Connectors**:

1. **Create cloud workspace** — stores a bearer token in the browser. Without `DATABASE_URL`, data persists under `./data/` (local demo). With Neon Postgres, it uses Prisma.
2. **Stripe** — paste a restricted read-only key (`rk_…`) to sync MRR from active subscriptions. OAuth Connect is available when `STRIPE_CLIENT_ID` + `STRIPE_SECRET_KEY` are set.
3. **Trust page** — publish verified MRR/ARR/customers + sparkline at `/trust/[slug]` (TrustMRR-style public source of truth) and embed `/trust/[slug]/badge`.
4. **Cloud files** — upload CSVs to Vercel Blob (`BLOB_READ_WRITE_TOKEN`) or `./storage/`.
5. **Benchmarks** — survey tables + live anonymized peer medians from public Trust pages (unlocks at ≥5 peers in your ARR band).

### Production env

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon / Postgres |
| `ENCRYPTION_KEY` | Encrypt Stripe keys at rest |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob uploads |
| `STRIPE_CLIENT_ID` / `STRIPE_SECRET_KEY` | Connect OAuth (optional) |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs for Trust / OAuth redirects |

Apply schema: run `prisma/migrations/0_init/migration.sql` on Neon, or `npx prisma migrate dev` once your Prisma migrate workflow is configured.
