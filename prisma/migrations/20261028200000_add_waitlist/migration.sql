-- CreateTable
CREATE TABLE "waitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedAt" TIMESTAMP(3),

    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_email_key" ON "waitlist"("email");

-- Row-Level Security: Prisma never enables this itself, and Supabase exposes
-- every public table through its REST API unless it is on (see PROJECT.md).
-- No policies on purpose: this fully blocks that path, while the app's
-- direct connection (the table owner) is unaffected.
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;
