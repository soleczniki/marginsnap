import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";
import { sendEmail } from "@/lib/email";

// Shared helpers for the closed-beta waiting list (2026-10-28).

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

// API routes are not covered by requireAdminPage, so admin endpoints check
// the session themselves. Returns true only for a signed-in admin.
export async function isAdminRequest(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const viewer = await prisma.user.findUnique({ where: { id: session.user.id } });
  return !!viewer && isAdminUser(viewer);
}

// Invitation email. Best-effort: returns false if sending failed, so the
// admin page can say so instead of silently pretending it was sent.
export async function sendInviteEmail(email: string): Promise<boolean> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.marginsnap.app";
  const signInUrl = `${baseUrl}/auth/signin`;
  try {
    await sendEmail(
      email,
      "You're invited to the MarginSnap beta",
      `<body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111;">
  <h2 style="margin: 0 0 8px;">You're invited to MarginSnap</h2>
  <p style="color: #555; margin: 0 0 16px;">A spot opened up in the MarginSnap beta. MarginSnap shows what you actually made on each Etsy sale, after fees, shipping and your own costs.</p>
  <p style="color: #555; margin: 0 0 20px;">To get started, go to the sign-in page and enter <strong>${email}</strong> (this exact address). We'll email you a link to confirm it, and your 30-day free trial starts then. No card needed.</p>
  <p style="margin: 0 0 20px;">
    <a href="${signInUrl}" style="display:inline-block;padding:12px 22px;background:#e8622c;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Open MarginSnap</a>
  </p>
  <p style="color: #555; margin: 0 0 8px;">This is early access, so things may break. If you hit a problem or miss something, use the Feedback tab on the right edge of the screen, or just reply to this email.</p>
</body>`,
      `You're invited to MarginSnap\n\nA spot opened up in the MarginSnap beta. To get started, go to ${signInUrl} and enter ${email} (this exact address). We'll email you a link to confirm it, and your 30-day free trial starts then. No card needed.\n\nThis is early access, so things may break. Use the Feedback tab on the right edge of the screen, or just reply to this email.`
    );
    return true;
  } catch (err) {
    console.error("Invite email failed:", err);
    return false;
  }
}
