import type { User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// The one permanent admin-dashboard owner (2026-09-23, Bogdan's decision:
// "superadmin and the main owner should only be one — me"). Hardcoded here
// rather than stored as a database flag on purpose: a value in the database
// can be edited — by a bug, a bad migration, or another admin this account
// promotes later — and this one specifically must not be. Changing who the
// superadmin is means editing this constant and redeploying, nothing else.
export const SUPERADMIN_EMAIL = "kolina@kolina.lt";

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
}

/** True for the hardcoded superadmin, or any other user the superadmin has
 * promoted via User.isAdmin (see /admin — only the superadmin sees the
 * promote/demote controls, and the route behind them checks
 * isSuperAdminEmail again server-side; never trust the UI alone). */
export function isAdminUser(user: Pick<User, "email" | "isAdmin"> | null | undefined): boolean {
  if (!user) return false;
  return isSuperAdminEmail(user.email) || user.isAdmin === true;
}

/** For /admin/* SERVER COMPONENTS only — redirects rather than returning an
 * error response, since a page render has nowhere else to send a 403. API
 * routes must NOT use this (a redirect makes no sense for a fetch() call) —
 * they check the session + isAdminUser/isSuperAdminEmail themselves and
 * return a real 401/403 JSON response instead, e.g.
 * src/app/api/admin/users/[id]/toggle-admin/route.ts. */
export async function requireAdminPage(): Promise<User> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!isAdminUser(user)) redirect("/dashboard");
  return user!;
}

/** Same as requireAdminPage, but for the superadmin-only bits (currently
 * just granting/revoking other admins) — sends a merely-admin user back to
 * the regular /admin page rather than 404ing them. */
export async function requireSuperAdminPage(): Promise<User> {
  const user = await requireAdminPage();
  if (!isSuperAdminEmail(user.email)) redirect("/admin");
  return user;
}
