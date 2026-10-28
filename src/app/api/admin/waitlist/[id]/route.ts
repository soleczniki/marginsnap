import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminRequest, sendInviteEmail } from "@/lib/waitlist";

// Admin-only: PATCH {action: "invite"} invites (or re-sends the invitation
// to) a waiting-list entry; DELETE removes it. Removing an entry that
// already has an account does not touch the account.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (body?.action !== "invite") return NextResponse.json({ error: "invalid action" }, { status: 400 });

  const entry = await prisma.waitlistEntry.findUnique({ where: { id: params.id } });
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (entry.status === "joined") return NextResponse.json({ error: "Already has an account." }, { status: 409 });

  await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: "invited", invitedAt: new Date() },
  });
  const emailSent = await sendInviteEmail(entry.email);
  return NextResponse.json({ ok: true, emailSent });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    await prisma.waitlistEntry.delete({ where: { id: params.id } });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
