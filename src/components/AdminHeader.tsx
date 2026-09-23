import { Logo } from "@/components/Logo";

// Shared header for the two /admin pages — same visual language as the
// dashboard's own header (Logo left, muted links right) but with just a
// "back" link plus Sign out instead of the full subscribe/costs/ad-spend
// nav, since none of that applies inside the admin area.
//
// backHref/backLabel are both optional (2026-09-23 fix): the top-level
// /admin page omits them for the superadmin specifically, since "Back to
// dashboard" would just bounce it straight back to /admin (dashboard/page.tsx
// redirects that account away from the regular dashboard entirely — see
// src/lib/admin.ts) — a dead-feeling link back to the page you're already
// on. Sign out is always shown regardless, since the admin area otherwise
// had NO way to sign out at all.
export function AdminHeader({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid var(--line)",
        marginBottom: 24,
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <Logo />
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {backHref && (
          <a href={backHref} style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {backLabel}
          </a>
        )}
        <a href="/auth/signout" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Sign out
        </a>
      </div>
    </header>
  );
}
