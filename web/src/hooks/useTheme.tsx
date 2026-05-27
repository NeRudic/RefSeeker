import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

const STORAGE_KEY = "refseeker-theme";

function getInitialDark(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    const initial = getInitialDark();
    applyTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyTheme(dark);
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  const toggle = useCallback(() => setDark((prev) => !prev), []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
