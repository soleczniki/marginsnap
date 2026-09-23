// Shared footer for every signed-in page (2026-09-23, Bogdan's request —
// "the footer is gone in mobile whenever you are already inside of the
// dashboard... it has to be there all the time"). There actually was no
// footer anywhere inside the authenticated app before this — only
// LandingPage.tsx (the signed-out marketing page) had one — so this wasn't
// a mobile-only regression, just a gap across the whole dashboard area.
// Same look as the landing page's footer (border-top + surface background,
// see LandingPage.tsx's own 2026-09-23 fix for why it's styled that way —
// otherwise it blends into the page background and reads as "not there").
export function Footer() {
  return (
    <footer
      style={{
        textAlign: "center",
        padding: "24px",
        fontSize: "0.82rem",
        color: "var(--muted)",
        borderTop: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
    </footer>
  );
}
