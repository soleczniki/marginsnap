import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// "Disconnect shop" on /dashboard/settings. Deletes the signed-in user's own
// shop only (never an id from the client); the Shop relations cascade to its
// listings, orders, cost history and ad spend. The user can connect a shop
// again afterwards from the dashboard.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await prisma.shop.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
