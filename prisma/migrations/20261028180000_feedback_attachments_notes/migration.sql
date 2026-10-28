-- Feedback: screenshot/video attachments (stored in Supabase Storage, this
-- column only holds their paths) and a private admin note per item.
-- The table already has Row-Level Security enabled (see the earlier
-- add_feedback migration); adding columns does not change that.
ALTER TABLE "feedback" ADD COLUMN "attachments" JSONB,
ADD COLUMN "notes" TEXT;
