import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import nodemailer from "nodemailer";
import { prisma } from "./db";

// Email magic-link auth (Blueprint decision: "no password reset flow to
// build; matches the fast, no-friction pitch"). Needs a real SMTP/email API
// provider (Resend, Postmark, etc.) — see .env.example for the vars this reads.
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM ?? "MarginSnap <hello@marginsnap.app>",
      // Short-lived on purpose: the landing page shows a 5-minute countdown
      // that matches this, then offers "Request a new sign-in link".
      maxAge: 60 * 5,
      // Custom send (2026-09-17 fix for the backlog's "sign in link is no
      // longer valid" bug): NextAuth's default behavior emails the real,
      // token-consuming callback URL directly, as the link's own href. Some
      // mail security scanners (Gmail's own link-scanning, corporate mail
      // gateways) auto-visit every link in an email BEFORE the real human
      // click — that pre-fetch burns this one-time token, so the user's own
      // click then hits "no longer valid" despite never having clicked it
      // themselves yet.
      //
      // Fix: the emailed link points at an intermediate page
      // (/auth/confirm?u=<real url>) instead of the real callback URL.
      // Visiting that page does nothing — it's just a normal page, safe for
      // a scanner to pre-fetch. Only an actual client-side click (see
      // src/app/auth/confirm/page.tsx — a JS onClick, not a plain <a href>)
      // navigates on to the real token-consuming URL, and passive scanner
      // fetches never execute that JS, so they can no longer burn the token.
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.marginsnap.app";
        const confirmUrl = new URL("/auth/confirm", baseUrl);
        confirmUrl.searchParams.set("u", url);

        const transport = nodemailer.createTransport(provider.server);
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: "Sign in to MarginSnap",
          text: `Sign in to MarginSnap:\n${confirmUrl.toString()}\n\nThis link expires in 5 minutes. If you didn't request this, ignore this email.`,
          html: `
<body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111;">
  <h2 style="margin: 0 0 8px;">Sign in to MarginSnap</h2>
  <p style="color: #555; margin: 0 0 20px;">Click below to finish signing in. This link expires in 5 minutes.</p>
  <p style="margin: 0 0 20px;">
    <a href="${confirmUrl.toString()}" style="display:inline-block;padding:12px 22px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
      Sign in to MarginSnap
    </a>
  </p>
  <p style="color: #999; font-size: 0.85rem;">If you didn't request this, you can safely ignore this email.</p>
</body>`,
        });
      },
    }),
  ],
  pages: {
    signIn: "/", // the landing page hosts the "enter your email" form
    verifyRequest: "/", // "check your email" state, handled client-side by ?checkEmail=1
  },
  callbacks: {
    // Database sessions don't include the user id by default — every route
    // above (dashboard, etsy/connect, etsy/callback) relies on session.user.id.
    session: async ({ session, user }) => {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Starts the free trial the moment the account itself exists (2026-09-17,
    // Bogdan's call) — not when Etsy gets connected — so someone who signs
    // up and then puts off the setup doesn't get extra time for free.
    // Fires exactly once, when the Prisma adapter creates a brand-new User
    // row (i.e. on a first sign-in, never on a returning user's sign-in).
    // See src/lib/billing.ts for how trialEndsAt gates the app.
    createUser: async ({ user }) => {
      await prisma.user.update({
        where: { id: user.id },
        data: { trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
    },
  },
};
