import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/cn";
import { Search, Image, Hexagon, LogIn, UserPlus, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/app/auth-context";

const links = [
  { to: "/", label: "Search", icon: Search },
  { to: "/gallery", label: "Gallery", icon: Image },
];

function UserMenu() {
  const { user, isAuthenticated, rateLimit, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-1">
        <Link
          to="/login"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </Link>
        <Link
          to="/register"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-accent-600 text-white hover:bg-accent-500 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Sign up
        </Link>
      </div>
    );
  }

  const remaining = rateLimit?.remaining ?? 0;
  const limit = rateLimit?.limit ?? 0;
  const pct = limit > 0 ? remaining / limit : 1;
  const badgeColor = pct <= 0 ? "text-red-400" : pct <= 0.2 ? "text-amber-400" : "text-neutral-400";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/5 transition-colors"
      >
        <span className="truncate max-w-[100px]">{user.email}</span>
        {user.role !== "free" && (
          <span className={cn(
            "rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold",
            user.role === "pro" && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
            user.role === "premium" && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
            user.role === "admin" && "bg-red-500/10 text-red-400 border border-red-500/20",
          )}>
            {user.role}
          </span>
        )}
        <span className={cn("tabular-nums", badgeColor)}>
          {remaining}/{limit}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 glass rounded-xl p-1.5 min-w-[160px] shadow-xl border border-white/5">
            {user.role === "admin" && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-white/5 transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin panel
              </Link>
            )}
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-neutral-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Navbar() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold text-neutral-100"
        >
          <Hexagon className="h-5 w-5 text-accent-400" />
          <span>RefSeeker</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                pathname === to
                  ? "bg-white/10 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
          <div className="ml-2 pl-2 border-l border-white/5">
            <UserMenu />
          </div>
        </nav>
      </div>
    </header>
  );
}
