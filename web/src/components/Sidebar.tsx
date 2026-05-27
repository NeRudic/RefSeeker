import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  Search,
  FolderOpen,
  LayoutDashboard,
  Users,
  LogIn,
  UserPlus,
  X,
  Image,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

function NavItem({ to, icon, label, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-accent-500/15 text-accent-400 border border-accent-500/25"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-obsidian-800 border border-transparent"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { authenticated, user } = useAuth();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-obsidian-700/50 bg-obsidian-900/80 backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-obsidian-700/50 bg-obsidian-900/95 backdrop-blur-xl transform transition-transform duration-300 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-obsidian-700/50">
          <span className="text-gradient font-semibold text-lg">RefSeeker</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>
        <SidebarContent onNavClick={onClose} />
      </aside>
    </>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { authenticated, user } = useAuth();

  const close = onNavClick;

  return (
    <div className="flex flex-col flex-1 p-3 gap-1">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 mb-2">
        <div className="w-8 h-8 rounded-lg bg-accent-gradient flex items-center justify-center">
          <Image size={18} className="text-white" />
        </div>
        <span className="text-gradient font-semibold text-lg">RefSeeker</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavItem to="/" icon={<Search size={18} />} label="Search" onClick={close} />
        <NavItem to="/collections" icon={<FolderOpen size={18} />} label="Collections" onClick={close} />

        {authenticated && user?.role === "admin" && (
          <>
            <div className="mt-4 mb-1 px-3">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Admin</span>
            </div>
            <NavItem to="/admin" icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={close} />
            <NavItem to="/admin/users" icon={<Users size={18} />} label="Users" onClick={close} />
          </>
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-obsidian-700/50">
        {authenticated ? (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-zinc-200 truncate">{user?.email}</p>
            <p className="text-xs text-zinc-500 capitalize">{user?.role}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <NavItem to="/login" icon={<LogIn size={18} />} label="Sign In" onClick={close} />
            <NavItem to="/register" icon={<UserPlus size={18} />} label="Sign Up" onClick={close} />
          </div>
        )}
      </div>
    </div>
  );
}
