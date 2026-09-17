-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastRenewalReminderAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialReminderStagesSent" TEXT[] DEFAULT ARRAY[]::TEXT[];
