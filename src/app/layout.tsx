import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarginSnap",
  description: "See what you actually made on that sale, in the time it takes to wrap the package.",
  manifest: "/manifest.json",
  // Browser tab icon (2026-09-17 — was showing the default globe since
  // nothing here ever pointed the browser at one). favicon.ico under
  // src/app/ is picked up automatically by Next's App Router for the
  // classic /favicon.ico request; the entries below cover the modern
  // <link rel="icon"> path and the iOS home-screen icon. All three are
  // just resized copies of the same public/icons/icon-512.png the PWA
  // manifest already used — no new artwork, just finally wired up.
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2f6f4e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          // Registers the app-shell service worker (public/sw.js) — see that
          // file's header for what it does and doesn't cache.
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
