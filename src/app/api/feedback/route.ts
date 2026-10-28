import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  ALLOWED_TYPES,
  MAX_FILES,
  MAX_FILE_BYTES,
  createDownloadUrls,
  type FeedbackAttachment,
} from "@/lib/feedbackStorage";

// In-app feedback submit (2026-10-28). Signed-in users only, so every
// message can be tied to an account; limited to 10 per user per hour so a
// stuck script or a bored visitor can't flood the table or the inbox.
// The notification email is best-effort: the feedback is already saved by
// the time it is sent, so a mail failure never loses a message. It carries
// Reply-To = the user's address, so Reply in the inbox answers the user.
const TYPE_LABELS: Record<string, string> = {
  bug: "Bug report",
  feature: "Feature request",
  other: "Other",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Only accept attachment records that look exactly like what the upload step
// hands out: inside this user's own folder, an allowed type, a sane size.
function cleanAttachments(raw: unknown, userId: string): FeedbackAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: FeedbackAttachment[] = [];
  for (const item of raw.slice(0, MAX_FILES)) {
    const path = typeof item?.path === "string" ? item.path : "";
    const type = typeof item?.type === "string" ? item.type : "";
    const size = typeof item?.size === "number" ? item.size : 0;
    const name = typeof item?.name === "string" ? item.name.slice(0, 120) : "file";
    if (!path.startsWith(`${userId}/`) || path.includes("..") || path.length > 300) continue;
    if (!ALLOWED_TYPES.includes(type)) continue;
    if (size <= 0 || size > MAX_FILE_BYTES) continue;
    out.push({ path, name, type, size });
  }
  return out;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const pageUrl = typeof body?.pageUrl === "string" ? body.pageUrl.slice(0, 300) : null;

  if (typeof type !== "string" || !(type in TYPE_LABELS)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json({ error: "Please write a little more." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "That is too long - please keep it under 4000 characters." }, { status: 400 });
  }

  const recent = await prisma.feedback.count({
    where: { userId: session.user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= 10) {
    return NextResponse.json({ error: "Too many messages in the last hour - please try again later." }, { status: 429 });
  }

  const email = session.user.email ?? null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const attachments = cleanAttachments(body?.attachments, session.user.id);

  await prisma.feedback.create({
    data: {
      userId: session.user.id,
      email,
      type,
      message,
      pageUrl,
      userAgent,
      ...(attachments.length > 0 ? { attachments } : {}),
    },
  });

  try {
    const label = TYPE_LABELS[type];
    const to = process.env.FEEDBACK_NOTIFY_EMAIL ?? "hello@marginsnap.app";
    const details = [`From: ${email ?? "unknown"}`, `Page: ${pageUrl ?? "n/a"}`, `Browser: ${userAgent ?? "n/a"}`];

    let attachmentsHtml = "";
    let attachmentsText = "";
    if (attachments.length > 0) {
      const urls = await createDownloadUrls(
        attachments.map((a) => a.path),
        365 * 24 * 60 * 60
      );
      const lines = attachments.map((a) => ({ name: a.name, url: urls[a.path] }));
      attachmentsHtml =
        `<p><strong>Attachments</strong> (links work for a year; the admin Feedback page always has fresh ones)<br>` +
        lines
          .map((l) => (l.url ? `<a href="${escapeHtml(l.url)}">${escapeHtml(l.name)}</a>` : escapeHtml(l.name)))
          .join("<br>") +
        `</p>`;
      attachmentsText =
        `\n\nAttachments (links work for a year):\n` + lines.map((l) => (l.url ? `${l.name}: ${l.url}` : l.name)).join("\n");
    }

    await sendEmail(
      to,
      `[MarginSnap feedback] ${label} from ${email ?? "a user"}`,
      `<p><strong>${escapeHtml(label)}</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>${attachmentsHtml}<p style="color:#666">${details.map(escapeHtml).join("<br>")}</p>`,
      `${label}\n\n${message}${attachmentsText}\n\n${details.join("\n")}`,
      email ? { replyTo: email } : undefined
    );
  } catch (err) {
    console.error("Feedback notification email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
