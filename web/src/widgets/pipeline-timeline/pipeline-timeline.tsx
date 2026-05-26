import { motion } from "framer-motion";
import { cn } from "@/shared/lib/cn";
import {
  Search,
  Download,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export interface PipelineState {
  search: "idle" | "active" | "done";
  download: "idle" | "active" | "done";
  verify: "idle" | "active" | "done";
}

interface Step {
  key: keyof PipelineState;
  label: string;
  icon: LucideIcon;
}

const steps: Step[] = [
  { key: "search", label: "Search", icon: Search },
  { key: "download", label: "Download", icon: Download },
  { key: "verify", label: "Verify", icon: ShieldCheck },
];

interface Props {
  state: PipelineState;
  className?: string;
}

export function PipelineTimeline({ state, className }: Props) {
  return (
    <div className={cn("flex items-center gap-0", className)}>
      {steps.map((step, i) => {
        const status = state[step.key];
        const isActive = status === "active";
        const isDone = status === "done";
        const isLast = i === steps.length - 1;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex items-center gap-3">
              <motion.div
                animate={
                  isActive
                    ? { scale: [1, 1.05, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500",
                  isDone && "bg-success/10 text-success",
                  isActive && "bg-accent-500/15 text-accent-400 animate-pulse-ring",
                  !isDone && !isActive && "bg-white/[0.03] text-text-muted"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </motion.div>

              <div>
                <p
                  className={cn(
                    "text-xs font-medium transition-colors",
                    isDone && "text-success",
                    isActive && "text-accent-400",
                    !isDone && !isActive && "text-text-muted"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>

            {!isLast && (
              <div className="flex-1 mx-4">
                <div className="h-px rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{
                      width: state[steps[i + 1].key] === "done"
                        ? "100%"
                        : state[steps[i + 1].key] === "active"
                          ? "50%"
                          : "0%",
                      backgroundColor:
                        state[steps[i + 1].key] === "done"
                          ? "#34d399"
                          : state[steps[i + 1].key] === "active"
                            ? "#7c3aed"
                            : "transparent",
                    }}
                    transition={{ duration: 0.7 }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Event log ──────────────────────────────────────────────────────────────

interface EventLogItem {
  type: "approved" | "rejected" | "info";
  message: string;
  timestamp: number;
}

export function EventLog({ events }: { events: EventLogItem[] }) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-0.5 max-h-72 overflow-y-auto">
      {events.map((ev, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-1.5 text-[11px]",
            ev.type === "approved" && "bg-success/5 text-success",
            ev.type === "rejected" && "bg-red-500/5 text-red-400",
            ev.type === "info" && "bg-white/[0.02] text-text-muted"
          )}
        >
          {ev.type === "approved" && <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />}
          {ev.type === "rejected" && <XCircle className="mt-0.5 h-3 w-3 shrink-0" />}
          <span className="truncate">{ev.message}</span>
        </motion.div>
      ))}
    </div>
  );
}
