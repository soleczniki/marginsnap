import { Logo } from "@/components/Logo";

// Shared header for the two /admin pages — same visual language as the
// dashboard's own header (Logo left, a muted link right) but with just a
// "back" link instead of the full subscribe/costs/ad-spend/settings nav,
// since none of that applies inside the admin area.
export function AdminHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
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
      <a href={backHref} style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
        {backLabel}
      </a>
    </header>
  );
}
