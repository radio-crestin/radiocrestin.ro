import { useState, useEffect, useCallback } from "react";

function getResolved(theme: string): string {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<string>("system");
  const [resolvedTheme, setResolvedTheme] = useState<string>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") || "system";
    setThemeState(stored);
    const resolved = getResolved(stored);
    setResolvedTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => {
      const current = localStorage.getItem("theme") || "system";
      if (current === "system") {
        const r = getResolved("system");
        setResolvedTheme(r);
        document.documentElement.setAttribute("data-theme", r);
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    const resolved = getResolved(newTheme);
    setResolvedTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  return { theme, setTheme, resolvedTheme };
}
