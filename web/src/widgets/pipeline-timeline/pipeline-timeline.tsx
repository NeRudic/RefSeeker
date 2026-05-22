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
    <div
      className={cn(
        "glass rounded-2xl p-5 flex items-center justify-between",
        className
      )}
    >
      {steps.map((step, i) => {
        const status = state[step.key];
        const isActive = status === "active";
        const isDone = status === "done";
        const isLast = i === steps.length - 1;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500",
                  isDone && "bg-emerald-500/20 text-emerald-400",
                  isActive && "bg-accent-500/20 text-accent-400 animate-pulse-glow",
                  !isDone && !isActive && "bg-white/5 text-neutral-600"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>

              {/* Label */}
              <div>
                <p
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isDone && "text-emerald-400",
                    isActive && "text-accent-400",
                    !isDone && !isActive && "text-neutral-600"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 mx-4">
                <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      state[steps[i + 1].key] === "active" && "w-1/2 bg-accent-500 animate-pulse",
                      state[steps[i + 1].key] === "done" && "w-full bg-emerald-500",
                      state[steps[i + 1].key] === "idle" && "w-0"
                    )}
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

// ── Event log item ───────────────────────────────────────────────────────

interface EventLogItem {
  type: "approved" | "rejected" | "info";
  message: string;
  timestamp: number;
}

export function EventLog({ events }: { events: EventLogItem[] }) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-1 max-h-60 overflow-y-auto">
      {events.map((ev, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs animate-fade-in",
            ev.type === "approved" && "bg-emerald-500/5 text-emerald-400",
            ev.type === "rejected" && "bg-red-500/5 text-red-400",
            ev.type === "info" && "bg-white/5 text-neutral-400"
          )}
        >
          {ev.type === "approved" && <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />}
          {ev.type === "rejected" && <XCircle className="mt-0.5 h-3 w-3 shrink-0" />}
          <span className="truncate">{ev.message}</span>
        </div>
      ))}
    </div>
  );
}
