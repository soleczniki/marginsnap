import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// CSV export (promised in the Terms of Service, §7: "Export as CSV anytime").
// One row per order line item — the level profit is actually calculated at.
// Only ever exports the signed-in user's own shop.
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) {
    return NextResponse.json({ error: "no shop connected" }, { status: 404 });
  }

  const orders = await prisma.order.findMany({
    where: { shopId: shop.id },
    orderBy: { orderDate: "desc" },
    include: { lineItems: { include: { listing: true } } },
  });

  const header = [
    "Order Date",
    "Order Gross Amount",
    "Shipping Cost",
    "Listing Title",
    "SKU",
    "Quantity",
    "Unit Price",
    "Cost of Goods (at sale)",
    "Line Profit",
  ];

  const rows: string[] = [header.join(",")];

  for (const order of orders) {
    if (order.lineItems.length === 0) {
      // An order that hasn't matched to any of your listings yet — still
      // worth showing so nothing silently disappears from the export.
      rows.push(
        [
          order.orderDate.toISOString().slice(0, 10),
          Number(order.grossAmount).toFixed(2),
          Number(order.shippingCost).toFixed(2),
          "(no matching listing)",
          "",
          "",
          "",
          "",
          "",
        ]
          .map((v) => csvEscape(String(v)))
          .join(",")
      );
      continue;
    }

    for (const li of order.lineItems) {
      rows.push(
        [
          order.orderDate.toISOString().slice(0, 10),
          Number(order.grossAmount).toFixed(2),
          Number(order.shippingCost).toFixed(2),
          li.listing?.title ?? "(deleted listing)",
          li.listing?.sku ?? "",
          li.quantity,
          Number(li.unitPrice).toFixed(2),
          li.cogsAtSale !== null ? Number(li.cogsAtSale).toFixed(2) : "",
          li.lineProfit !== null ? Number(li.lineProfit).toFixed(2) : "",
        ]
          .map((v) => csvEscape(String(v)))
          .join(",")
      );
    }
  }

  const csv = rows.join("\n");
  const filename = `marginsnap-orders-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
