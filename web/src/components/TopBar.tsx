import { Menu, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { authenticated, user, remaining, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="flex items-center justify-between h-14 px-5 border-b border-obsidian-700/50 bg-obsidian-900/70 backdrop-blur-xl">
      <button
        className="lg:hidden text-zinc-400 hover:text-zinc-200 transition-colors"
        onClick={onMenuClick}
      >
        <Menu size={20} />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-4">
        <ThemeToggle />
        {authenticated && user && (
          <>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Requests left:</span>
              <span className={`font-mono font-medium ${remaining <= 1 ? "text-red-400" : "text-accent-400"}`}>
                {remaining === 999999 ? "∞" : `${remaining}/${user.daily_limit}`}
              </span>
            </div>
            <span className="hidden sm:block text-zinc-600">|</span>
          </>
        )}
        {authenticated ? (
          <button onClick={handleLogout} className="ghost-button flex items-center gap-2 text-sm">
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/login")} className="ghost-button text-sm">
              Sign In
            </button>
            <button onClick={() => navigate("/register")} className="accent-button text-sm !px-4 !py-1.5">
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
