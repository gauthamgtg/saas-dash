-- Initial MRRmark cloud schema (apply on Neon / Postgres)
-- prisma migrate deploy once DATABASE_URL is set, or run this SQL manually.

CREATE TABLE IF NOT EXISTS "Workspace" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "role" TEXT NOT NULL DEFAULT 'founder',
  "website" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "StripeConnection" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE,
  "mode" TEXT NOT NULL DEFAULT 'key',
  "encryptedSecret" TEXT NOT NULL,
  "stripeAccountId" TEXT,
  "accountEmail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TrustProfile" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE,
  "publicSlug" TEXT NOT NULL UNIQUE,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "companyName" TEXT NOT NULL,
  "website" TEXT,
  "source" TEXT NOT NULL DEFAULT 'csv',
  "verifiedMrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "verifiedArr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "customerCount" INTEGER NOT NULL DEFAULT 0,
  "sparklineJson" TEXT NOT NULL DEFAULT '[]',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrustProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CloudFile" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'payments',
  "url" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CloudFile_workspaceId_createdAt_idx" ON "CloudFile"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "MetricSnapshot" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "arrBand" TEXT NOT NULL,
  "mrr" DOUBLE PRECISION NOT NULL,
  "arr" DOUBLE PRECISION NOT NULL,
  "customers" INTEGER NOT NULL,
  "nrr" DOUBLE PRECISION,
  "growth" DOUBLE PRECISION,
  "logoChurn" DOUBLE PRECISION,
  "quickRatio" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetricSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MetricSnapshot_workspaceId_month_key" ON "MetricSnapshot"("workspaceId", "month");
CREATE INDEX IF NOT EXISTS "MetricSnapshot_arrBand_month_idx" ON "MetricSnapshot"("arrBand", "month");
