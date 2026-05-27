import { useTheme } from "../hooks/useTheme";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="relative w-[52px] h-7 rounded-full transition-all duration-300 flex items-center shrink-0
        bg-obsidian-700 border border-obsidian-600
        hover:border-accent-500/50"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span
        className="absolute w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300
          bg-obsidian-950 shadow-sm
          dark:bg-obsidian-800
          left-0.5 dark:left-[27px]"
      >
        {dark ? (
          <Moon size={12} className="text-accent-400" />
        ) : (
          <Sun size={12} className="text-amber-500" />
        )}
      </span>
    </button>
  );
}
