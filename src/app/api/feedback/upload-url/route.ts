import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";
import {
  ALLOWED_TYPES,
  MAX_FILE_BYTES,
  createUploadUrl,
  safeFileName,
  storageConfigured,
} from "@/lib/feedbackStorage";

// Step 1 of attaching a file to feedback: the browser asks for a one-time
// signed upload URL, then sends the file straight to Supabase Storage
// (see src/lib/feedbackStorage.ts for why). Every file lives under the
// uploading user's own id so /api/feedback can check ownership later.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: "Attachments are not available right now." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : 0;

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "That file type is not supported. Use PNG, JPG, GIF, WebP, MP4, WebM or MOV." },
      { status: 400 }
    );
  }
  if (size <= 0 || size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Files can be up to 25 MB." }, { status: 400 });
  }

  const path = `${session.user.id}/${randomUUID()}-${safeFileName(filename)}`;
  try {
    const uploadUrl = await createUploadUrl(path);
    return NextResponse.json({ path, uploadUrl });
  } catch (err) {
    console.error("Feedback upload URL failed:", err);
    // Admins also get the underlying reason, to make setup problems easy to
    // diagnose; regular users only see the generic message.
    const viewer = await prisma.user.findUnique({ where: { id: session.user.id } });
    const detail = isAdminUser(viewer) ? (err as Error).message : undefined;
    return NextResponse.json({ error: "Could not start the upload. Please try again.", detail }, { status: 500 });
  }
}
