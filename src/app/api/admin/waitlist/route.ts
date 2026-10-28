import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminRequest, normalizeEmail, sendInviteEmail } from "@/lib/waitlist";

// Admin-only: invite someone directly by email (they do not have to be on
// the waiting list yet). Creates or updates the entry as "invited" and sends
// the invitation email.
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
  if (existing?.status === "joined") {
    return NextResponse.json({ error: "That person already has an account." }, { status: 409 });
  }
  await prisma.waitlistEntry.upsert({
    where: { email },
    update: { status: "invited", invitedAt: new Date() },
    create: { email, status: "invited", invitedAt: new Date() },
  });
  const emailSent = await sendInviteEmail(email);
  return NextResponse.json({ ok: true, emailSent });
}
