import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";

// Admin-only: change a feedback item's status (new / planned / done /
// dismissed) and/or its private note. API routes are not covered by
// requireAdminPage, so the session and admin check are done here.
const STATUSES = ["new", "planned", "done", "dismissed"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const viewer = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!viewer || !isAdminUser(viewer)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const data: { status?: string; notes?: string | null } = {};

  if (body?.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body?.notes !== undefined) {
    if (typeof body.notes !== "string" || body.notes.length > 4000) {
      return NextResponse.json({ error: "invalid note" }, { status: 400 });
    }
    data.notes = body.notes.trim() === "" ? null : body.notes;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    await prisma.feedback.update({ where: { id: params.id }, data });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
