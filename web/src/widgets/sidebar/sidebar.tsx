import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/cn";
import {
  Search,
  Image,
  Hexagon,
  LogIn,
  UserPlus,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/app/auth-context";

const links = [
  { to: "/", label: "Search", icon: Search },
  { to: "/gallery", label: "Gallery", icon: Image },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { user, isAuthenticated, rateLimit, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const remaining = rateLimit?.remaining ?? 0;
  const limit = rateLimit?.limit ?? 0;
  const pct = limit > 0 && remaining >= 0 ? remaining / limit : 1;
  const usageColor =
    pct <= 0 ? "text-red-400" : pct <= 0.2 ? "text-amber-400" : "text-text-muted";

  return (
    <motion.aside
      className="fixed left-0 top-0 z-50 h-full flex flex-col glass-deep border-r border-border"
      animate={{ width: expanded ? 240 : 64 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Logo */}
      <Link
        to="/"
        className="flex items-center gap-3 h-14 px-4 border-b border-border shrink-0"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl accent-gradient shadow-lg shadow-accent-500/20 shrink-0">
          <Hexagon className="h-4 w-4 text-white" />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="text-sm font-semibold text-text-primary whitespace-nowrap"
            >
              RefSeeker
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 h-10 rounded-xl px-3 transition-all duration-200 group",
                active
                  ? "bg-accent-500/10 text-accent-400"
                  : "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    className="text-xs font-medium whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-2 border-t border-border">
        {!isAuthenticated ? (
          <div className="space-y-1">
            <Link
              to="/login"
              className="flex items-center gap-3 h-10 rounded-xl px-3 text-text-muted hover:text-text-secondary hover:bg-white/[0.04] transition-all duration-200"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              {expanded && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-medium whitespace-nowrap"
                >
                  Sign in
                </motion.span>
              )}
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-3 h-10 rounded-xl px-3 accent-gradient text-white hover:opacity-90 transition-all duration-200"
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              {expanded && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-medium whitespace-nowrap"
                >
                  Sign up
                </motion.span>
              )}
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {/* User info pill */}
            <div
              className={cn(
                "flex items-center gap-3 h-10 rounded-xl px-3 transition-colors cursor-default",
                expanded && "hover:bg-white/[0.04]"
              )}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500/15 text-accent-400 shrink-0">
                <span className="text-[11px] font-semibold uppercase">
                  {user?.email?.charAt(0) ?? "?"}
                </span>
              </div>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="min-w-0 flex-1"
                >
                  <p className="text-xs font-medium text-text-primary truncate">
                    {user?.email ?? ""}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {user?.role !== "free" && (
                      <span
                        className={cn(
                          "text-[10px] uppercase font-semibold rounded px-1",
                          user?.role === "pro" &&
                            "bg-blue-500/10 text-blue-400",
                          user?.role === "premium" &&
                            "bg-purple-500/10 text-purple-400",
                          user?.role === "admin" &&
                            "bg-red-500/10 text-red-400"
                        )}
                      >
                        {user?.role}
                      </span>
                    )}
                    <span className={cn("text-[10px] tabular-nums", usageColor)}>
                      {remaining}/{limit === -1 ? "∞" : limit}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Admin link */}
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="flex items-center gap-3 h-9 rounded-xl px-3 text-text-muted hover:text-text-secondary hover:bg-white/[0.04] transition-all duration-200"
              >
                <Shield className="h-4 w-4 shrink-0" />
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs font-medium whitespace-nowrap"
                  >
                    Admin
                  </motion.span>
                )}
              </Link>
            )}

            {/* Sign out */}
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 h-9 rounded-xl px-3 text-text-muted hover:text-red-400 hover:bg-white/[0.04] transition-all duration-200"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {expanded && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-medium whitespace-nowrap"
                >
                  Sign out
                </motion.span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute -right-3 top-[50%] -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 border border-border text-text-muted hover:text-text-primary transition-colors"
      >
        {expanded ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
    </motion.aside>
  );
}
