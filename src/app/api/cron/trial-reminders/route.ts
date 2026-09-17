import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Daily trial-lifecycle email job (2026-09-17, Bogdan's request) — a
// separate cron from the sync job (src/app/api/cron/sync) so a bug in one
// can never block the other. Two things happen here, once a day, for every
// user who isn't already subscriptionStatus "active":
//   - Countdown reminders at 14/10/7/5/3/1 days left in the free trial
//     (User.trialEndsAt). Each stage fires at most once — tracked in
//     User.trialReminderStagesSent — so a cron that runs slightly late or
//     twice in a day can't double-send the same one.
//   - Once the trial's over, a "still want MarginSnap?" nag repeated every
//     ~3 weeks for as long as they stay unsubscribed, tracked via
//     User.lastRenewalReminderAt.
// Configured in vercel.json alongside the sync cron; Vercel Cron calls
// this with CRON_SECRET as a bearer token, same pattern as sync's route.
const REMINDER_STAGES = [14, 10, 7, 5, 3, 1];
const RENEWAL_REMINDER_INTERVAL_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_URL = "https://www.marginsnap.app/dashboard";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const users = await prisma.user.findMany({
    where: { trialEndsAt: { not: null }, subscriptionStatus: { not: "active" } },
  });

  let countdownsSent = 0;
  let renewalsSent = 0;

  for (const user of users) {
    if (!user.email || !user.trialEndsAt) continue;
    const daysLeft = Math.ceil((user.trialEndsAt.getTime() - now) / DAY_MS);

    if (daysLeft >= 0) {
      const isReminderDay = REMINDER_STAGES.includes(daysLeft);
      const alreadySent = user.trialReminderStagesSent.includes(String(daysLeft));
      if (isReminderDay && !alreadySent) {
        const timeLeft = daysLeft === 1 ? "ends tomorrow" : `ends in ${daysLeft} days`;
        await sendEmail(
          user.email,
          daysLeft === 1 ? "Your MarginSnap trial ends tomorrow" : `${daysLeft} days left in your MarginSnap trial`,
          `<p>Hi,</p><p>Your 30-day MarginSnap trial ${timeLeft}. Subscribe for $9/mo anytime to keep your dashboard, syncing, and cost history.</p><p><a href="${DASHBOARD_URL}">Open MarginSnap</a></p>`,
          `Your MarginSnap trial ${timeLeft}. Subscribe for $9/mo anytime: ${DASHBOARD_URL}`
        );
        await prisma.user.update({
          where: { id: user.id },
          data: { trialReminderStagesSent: { push: String(daysLeft) } },
        });
        countdownsSent++;
      }
    } else {
      const dueForRenewalNag =
        !user.lastRenewalReminderAt || now - user.lastRenewalReminderAt.getTime() >= RENEWAL_REMINDER_INTERVAL_DAYS * DAY_MS;
      if (dueForRenewalNag) {
        await sendEmail(
          user.email,
          "Renew MarginSnap?",
          `<p>Hi,</p><p>Your MarginSnap trial ended, but your account and data are still here — nothing's been deleted. Subscribe for $9/mo anytime to pick back up.</p><p><a href="${DASHBOARD_URL}">Renew MarginSnap</a></p>`,
          `Your MarginSnap trial ended. Subscribe for $9/mo anytime to pick back up: ${DASHBOARD_URL}`
        );
        await prisma.user.update({ where: { id: user.id }, data: { lastRenewalReminderAt: new Date() } });
        renewalsSent++;
      }
    }
  }

  return NextResponse.json({ usersChecked: users.length, countdownsSent, renewalsSent });
}
