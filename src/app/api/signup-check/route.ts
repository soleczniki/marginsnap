import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/waitlist";

// Used only by the sign-up form (2026-10-28, Bogdan's request): an email that
// already has an account must not be accepted as a new sign-up, so the form
// asks first and points the person to Sign in instead. Trade-off accepted:
// this tells a visitor whether an address has an account (same as most
// sign-up forms that say "email already in use").
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ exists: false });
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return NextResponse.json({ exists: !!user });
}
