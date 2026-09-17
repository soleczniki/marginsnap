import nodemailer from "nodemailer";

// Shared transactional-email helper (2026-09-17, for the trial-reminder
// cron) — deliberately separate from auth.ts's own sendVerificationRequest
// (that one is shaped around NextAuth's EmailProvider callback and its own
// confirm-page fix for the magic-link-burned-by-scanners bug; this one is
// for anything else MarginSnap emails a user directly). Same SMTP env vars,
// one shared transport instance rather than creating a new one per send.
const transport = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  await transport.sendMail({
    to,
    from: process.env.EMAIL_FROM ?? "MarginSnap <hello@marginsnap.app>",
    subject,
    html,
    text,
  });
}
