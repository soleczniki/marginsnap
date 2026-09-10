import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
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
};
