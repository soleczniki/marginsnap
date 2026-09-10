import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CogsEditor } from "@/components/CogsEditor";

// "Manage costs" (Blueprint workflow §2) — the screen the rest of the app has
// been pointing at ("that entry screen is next up"). Type in what each item
// costs you to make; MarginSnap uses it for every order synced from here on.
// Editing a cost never changes profit on orders already synced (see the note
// in src/app/api/listings/[id]/cogs/route.ts).
export default async function ManageCosts() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) redirect("/dashboard");

  const listings = await prisma.listing.findMany({
    where: { shopId: shop.id },
    orderBy: { title: "asc" },
  });

  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid var(--line)",
          marginBottom: 24,
        }}
      >
        <span style={{ fontWeight: 700 }}>MarginSnap</span>
        <a href="/api/auth/signout" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Sign out
        </a>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 80px" }}>
        <a href="/dashboard" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          ← Back to dashboard
        </a>
        <h1 style={{ fontSize: "1.4rem", margin: "8px 0 4px" }}>Manage costs</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          Type in what each item actually costs you to make (materials, packaging — whatever you
          count). This only affects orders synced from now on, not ones you&rsquo;ve already seen.
        </p>

        {listings.length === 0 && (
          <p style={{ color: "var(--muted)" }}>
            No listings synced yet — go back to the dashboard and click &ldquo;Sync now.&rdquo;
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div>{listing.title}</div>
                {listing.sku && (
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>SKU: {listing.sku}</div>
                )}
              </div>
              <CogsEditor
                listingId={listing.id}
                initialCogs={listing.cogsAmount ? Number(listing.cogsAmount) : null}
              />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
