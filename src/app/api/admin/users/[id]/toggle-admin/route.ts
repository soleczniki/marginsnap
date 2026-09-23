import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSuperAdminEmail } from "@/lib/admin";

// Grant/revoke another user's /admin access. Superadmin-only, checked here
// server-side — the AdminToggle button that calls this is only ever shown
// to the superadmin in the UI, but that's a convenience, not the actual
// gate; this route re-checks independently so a crafted request from
// anyone else still gets a 403. The one hardcoded superadmin (src/lib/admin.ts)
// can never be changed through this route — its access doesn't come from
// the database at all, see isAdminUser.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const viewer = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!viewer || !isSuperAdminEmail(viewer.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const isAdmin = body?.isAdmin;
  if (typeof isAdmin !== "boolean") {
    return NextResponse.json({ error: "isAdmin must be true or false" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  if (isSuperAdminEmail(target.email)) {
    // No-op by design — the superadmin's access comes from the hardcoded
    // email check in src/lib/admin.ts, not this flag, so there's nothing
    // here to toggle either way.
    return NextResponse.json({ error: "the superadmin account can't be changed here" }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data: { isAdmin } });
  return NextResponse.json({ ok: true, isAdmin: updated.isAdmin });
}
