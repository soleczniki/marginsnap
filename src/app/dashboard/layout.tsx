import { FeedbackWidget } from "@/components/FeedbackWidget";

// Every dashboard page gets the floating Feedback button (2026-10-28).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FeedbackWidget />
    </>
  );
}
