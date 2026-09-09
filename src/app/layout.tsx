import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarginSnap",
  description: "See what you actually made on that sale, in the time it takes to wrap the package.",
  manifest: "/manifest.json",
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
