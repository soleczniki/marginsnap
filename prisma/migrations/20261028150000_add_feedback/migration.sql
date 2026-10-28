-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_createdAt_idx" ON "feedback"("createdAt");

-- CreateIndex
CREATE INDEX "feedback_userId_idx" ON "feedback"("userId");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security: Prisma never enables this itself, and Supabase exposes
-- every public table through its REST API unless it is on (see PROJECT.md).
-- No policies on purpose: this fully blocks that path, while the app's
-- direct connection (the table owner) is unaffected.
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;
