import { useAuth } from "@/app/auth-context";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle } from "lucide-react";

export function RateLimitBanner() {
  const { rateLimit, isAuthenticated } = useAuth();

  if (!rateLimit) return null;

  const { remaining, limit } = rateLimit;
  if (limit <= 0) return null;

  const pct = remaining / limit;

  if (remaining <= 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-full max-w-lg px-4"
      >
        <div className="glass rounded-xl p-3 border border-red-500/15 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 shrink-0">
            <AlertCircle className="h-4 w-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-400">
              {isAuthenticated
                ? "You've used all your searches for today."
                : "You've used your free search."}
            </p>
          </div>
          {!isAuthenticated && (
            <Link
              to="/register"
              className="shrink-0 text-xs font-medium text-accent-400 hover:text-accent-300 transition-colors"
            >
              Sign up
            </Link>
          )}
        </div>
      </motion.div>
    );
  }

  if (pct <= 0.2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-full max-w-lg px-4"
      >
        <div className="glass rounded-xl p-3 border border-amber-500/15 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-xs text-amber-400">
            <strong>{remaining}</strong> search{remaining === 1 ? "" : "es"} remaining today
          </p>
        </div>
      </motion.div>
    );
  }

  return null;
}
