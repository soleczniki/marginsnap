import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInForm } from "@/components/SignInForm";

// Root route. Previously this was a client component that always rendered
// the sign-in form, with no session check at all — so a signed-in visitor
// landing on "/" (e.g. a bookmark, or just typing the bare domain) saw the
// login screen again instead of going straight to /dashboard (backlog item,
// 2026-09-16). Fixed the same way dashboard/page.tsx already redirects a
// signed-out visitor the other way: check the session here, server-side,
// before rendering anything.
export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/dashboard");

  return <SignInForm />;
}
