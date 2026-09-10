import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncShop } from "@/lib/sync";

// Manual "Sync now" button on the dashboard — session-gated (not the
// CRON_SECRET the scheduled job uses), only ever syncs the signed-in user's
// own shop.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) {
    return NextResponse.json({ error: "no shop connected" }, { status: 404 });
  }

  try {
    const result = await syncShop(shop);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
