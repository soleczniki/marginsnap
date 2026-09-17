-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- Data migration (hand-added, not Prisma-generated): backfill every shop
-- that already exists to "onboarded now" so the first-time wizard never
-- shows up retroactively for a shop that's already been in use — only a
-- shop connected AFTER this migration should ever see it (onboardedAt
-- starts out NULL for those, set by src/app/api/shop/onboarding/route.ts
-- once the wizard finishes).
UPDATE "shops" SET "onboardedAt" = CURRENT_TIMESTAMP WHERE "onboardedAt" IS NULL;
