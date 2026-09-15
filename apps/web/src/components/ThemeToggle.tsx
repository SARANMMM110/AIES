"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type AesTheme } from "@/lib/theme";

export function ThemeToggle({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "studio";
}) {
  const [theme, setTheme] = useState<AesTheme>("light");

  useEffect(() => {
    const initial = getStoredTheme();
    applyTheme(initial);
    setTheme(initial);
  }, []);

  function set(next: AesTheme) {
    applyTheme(next);
    setTheme(next);
  }

  if (variant === "studio") {
    return (
      <div className={`theme ${className}`.trim()}>
        <span className="sun" aria-hidden>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </span>
        <div className="seg" role="group" aria-label="Theme">
          <button type="button" className={theme === "light" ? "on" : ""} onClick={() => set("light")}>
            Light
          </button>
          <button type="button" className={theme === "dark" ? "on" : ""} onClick={() => set("dark")}>
            Dark
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`btn ghost theme-toggle ${className}`.trim()}
      onClick={() => set(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
