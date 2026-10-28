import { FeedbackWidget } from "@/components/FeedbackWidget";

// Admin pages get the floating Feedback button too (2026-10-28).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FeedbackWidget />
    </>
  );
}
