"use client";

const STORAGE_KEY = "aes_theme";

export type AesTheme = "light" | "dark";

export function getStoredTheme(): AesTheme {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "dark" ? "dark" : "light";
}

export function applyTheme(theme: AesTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme(): AesTheme {
  const next: AesTheme = getStoredTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
