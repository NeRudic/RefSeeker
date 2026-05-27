type Status = "approved" | "rejected" | "pending" | "connecting" | "running" | "complete" | "error";

const styles: Record<Status, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  rejected: "bg-red-500/15 text-red-400 border-red-500/25",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  connecting: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  running: "bg-accent-500/15 text-accent-400 border-accent-500/25 animate-pulse-soft",
  complete: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  error: "bg-red-500/15 text-red-400 border-red-500/25",
};

const labels: Record<Status, string> = {
  approved: "Approved",
  rejected: "Rejected",
  pending: "Pending",
  connecting: "Connecting",
  running: "Running",
  complete: "Complete",
  error: "Error",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "running" ? "animate-pulse-soft" : ""}`} style={{ backgroundColor: "currentColor" }} />
      {labels[status]}
    </span>
  );
}
