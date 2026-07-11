-- Base schema migration (ADR D8, B3/N2 pr2-review).
--
-- Applied FIRST, strictly BEFORE the raw-SQL partial-unique-index migration
-- (`20260711000001_partial_unique_indexes`) — that migration references the
-- "proposals" table created here, in its final shape.
--
-- Generated from prisma/schema.prisma via
-- `prisma migrate diff --from-empty --to-schema-datamodel=prisma/schema.prisma --script`
-- (no live database required) so the identifiers below are guaranteed to
-- match exactly what a Prisma-managed database expects — the same class of
-- guarantee B1 requires for the partial-index migration.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('ADMIN', 'HOSPITAL', 'ARTIST', 'PATIENT');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('HOSPITAL', 'ARTIST');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('OPEN', 'FILLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('CREATED', 'PUBLISHED', 'COMPLETED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempt_windows" (
    "key" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempt_windows_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "ProfileType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'PENDING',
    "reviewRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" TEXT NOT NULL,
    "hospitalProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_accountId_idx" ON "sessions"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_accountId_key" ON "profiles"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "events_slotId_key" ON "events"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "events_proposalId_key" ON "events"("proposalId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_hospitalProfileId_fkey" FOREIGN KEY ("hospitalProfileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
