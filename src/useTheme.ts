/** Persisted light/dark theme. Applies `data-theme` to <html>; CSS does the rest. */
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

function initial(): Theme {
  const saved = localStorage.getItem("openfoldui-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("openfoldui-theme", theme);
  }, [theme]);
  return [theme, setTheme];
}
