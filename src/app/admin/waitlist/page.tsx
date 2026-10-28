import type { CSSProperties } from "react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin";
import { AdminHeader } from "@/components/AdminHeader";
import { Footer } from "@/components/Footer";
import { WaitlistInviteForm, WaitlistRowActions } from "@/components/WaitlistAdmin";
import { getBetaStatus } from "@/lib/beta";

const STATUS_TABS = [
  { key: "waiting", label: "Waiting" },
  { key: "invited", label: "Invited" },
  { key: "joined", label: "Joined" },
  { key: "all", label: "All" },
];

function chipStyle(active: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "5px 11px",
    borderRadius: 999,
    fontSize: "0.85rem",
    border: "1px solid var(--line)",
    background: active ? "var(--accent)" : "var(--surface)",
    color: active ? "#fff" : "var(--ink)",
    textDecoration: "none",
  };
}

const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");

// Closed-beta waiting list (2026-10-28): who signed up, invite them (sends
// the invitation email and lets that address create an account), re-send,
// remove, or invite an address by hand. Also shows how many Etsy shops are
// connected against Etsy's Personal Access limit of 5 (own shop included),
// so Bogdan knows how many spots are really left.
export default async function AdminWaitlistPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminPage();

  const status = STATUS_TABS.some((t) => t.key === searchParams.status) ? (searchParams.status as string) : "waiting";

  const [items, grouped, beta] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: status === "waiting" ? "asc" : "desc" },
      take: 500,
    }),
    prisma.waitlistEntry.groupBy({ by: ["status"], _count: { _all: true } }),
    getBetaStatus(),
  ]);

  const counts: Record<string, number> = { waiting: 0, invited: 0, joined: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;
  const countFor = (key: string) => (key === "all" ? counts.waiting + counts.invited + counts.joined : (counts[key] ?? 0));

  const freeSlots = Math.max(0, beta.limit - beta.taken);

  return (
    <>
      <AdminHeader backHref="/admin" backLabel="← Back to admin" />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>
        <h1 style={{ fontSize: "1.4rem", marginBottom: 12 }}>Waiting list</h1>

        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 6px" }}>
            Sign-ups are <strong>{beta.closed ? "closed (beta full)" : "open"}</strong>
            {beta.mode === "auto" && " - automatic: they close by themselves when all spots are taken."}
            {beta.mode === "forced-open" && " - forced open by SIGNUPS_OPEN=true (the limit is ignored)."}
            {beta.mode === "forced-closed" && " - forced closed by SIGNUPS_OPEN=false."}
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
            Spots: {beta.taken} of {beta.limit} taken, {freeSlots} free (Etsy Personal Access limit, your own shop
            included). Taken = {beta.connectedShops} connected shop(s) + {beta.pendingSignups} sign-up(s) that have not
            connected a shop yet + {beta.openInvites} unused invitation(s).
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <WaitlistInviteForm />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {STATUS_TABS.map((t) => (
            <a key={t.key} href={t.key === "waiting" ? "/admin/waitlist" : `/admin/waitlist?status=${t.key}`} style={chipStyle(status === t.key)}>
              {t.label} ({countFor(t.key)})
            </a>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--muted)", margin: 0 }}>Nobody here.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "10px 12px" }}>Email</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px" }}>Signed up (UTC)</th>
                  <th style={{ padding: "10px 12px" }}>Invited (UTC)</th>
                  <th style={{ padding: "10px 12px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 12px", wordBreak: "break-all" }}>{item.email}</td>
                    <td style={{ padding: "10px 12px" }}>{item.status}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmt(item.createdAt)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmt(item.invitedAt)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <WaitlistRowActions id={item.id} status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
