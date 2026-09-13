import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { VatIdToggle } from "@/components/VatIdToggle";

// Fee-engine settings (feeEngine.ts / src/lib/sync.ts). Deliberately just one
// input here: sellerCountry is synced automatically from Etsy on every sync
// and shown read-only for transparency; sellerHasValidVatId is the one thing
// Etsy's API can't tell us, so it's the one thing a seller sets by hand.
export default async function Settings() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) redirect("/dashboard");

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
        <h1 style={{ fontSize: "1.4rem", margin: "8px 0 4px" }}>Settings</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          These two things decide how MarginSnap works out your Etsy fees for each order.
        </p>

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Shop country</div>
          <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 4 }}>
            {shop.sellerCountry
              ? `${shop.sellerCountry} — synced automatically from Etsy on every sync.`
              : "Not synced yet — click \"Sync now\" on the dashboard."}
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>VAT ID status</div>
          <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 12 }}>
            Etsy doesn&rsquo;t expose this through its API, so it&rsquo;s the one thing you tell us
            yourself. If you have a valid EU VAT ID on file with Etsy, Etsy applies the reverse
            charge and adds no VAT to your seller fees. If you don&rsquo;t (or you&rsquo;re not
            sure), leave this unchecked — that&rsquo;s the safer default and just means your fee
            total may come out very slightly higher than it actually is, never lower.
          </div>
          <VatIdToggle initialValue={shop.sellerHasValidVatId} />
        </div>
      </main>
    </>
  );
}
