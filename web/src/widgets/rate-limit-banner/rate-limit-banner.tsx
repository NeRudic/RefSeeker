import { useAuth } from "@/app/auth-context";
import { Link } from "react-router-dom";
import { AlertTriangle, AlertCircle } from "lucide-react";

export function RateLimitBanner() {
  const { rateLimit, isAuthenticated } = useAuth();

  if (!rateLimit) return null;

  const { remaining, limit } = rateLimit;
  if (limit <= 0) return null; // unlimited

  const pct = remaining / limit;

  if (remaining <= 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="glass rounded-xl p-3 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="text-red-400">
              {isAuthenticated
                ? "You've used all your searches for today."
                : "You've used your free search."}
            </span>{" "}
            {isAuthenticated ? (
              <span className="text-neutral-400">
                Upgrade your plan for more, or try again tomorrow.
              </span>
            ) : (
              <Link to="/register" className="text-accent-400 hover:text-accent-300 transition-colors font-medium">
                Sign up for more searches.
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (pct <= 0.2) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="glass rounded-xl p-3 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-400">
            Only <strong>{remaining}</strong> search{remaining === 1 ? "" : "es"} remaining today.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
