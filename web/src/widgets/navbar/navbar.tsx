import { Link, useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/cn";
import { Search, Image, Settings, Hexagon } from "lucide-react";

const links = [
  { to: "/", label: "Search", icon: Search },
  { to: "/gallery", label: "Gallery", icon: Image },
  { to: "/settings", label: "Settings", icon: Settings },
];

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
        </nav>
      </div>
    </header>
  );
}
