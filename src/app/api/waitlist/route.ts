import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/waitlist";

// Public: join the closed-beta waiting list (2026-10-28). Always answers
// {ok:true} for a valid email, whether or not it was already on the list,
// so the form cannot be used to find out who has signed up. A hidden
// "website" field (filled only by bots) and a global cap on new entries per
// 10 minutes keep it from being flooded.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body?.website) return NextResponse.json({ ok: true }); // honeypot

  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const recent = await prisma.waitlistEntry.count({
    where: { createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 100) {
    return NextResponse.json({ error: "Too many requests right now - please try again later." }, { status: 429 });
  }

  await prisma.waitlistEntry.upsert({ where: { email }, update: {}, create: { email } });
  return NextResponse.json({ ok: true });
}
