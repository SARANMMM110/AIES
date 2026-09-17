"use client";

import { useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastState = { message: string; tone: ToastTone };

const FLASH_KEY = "aes_toast_flash";
const EVENT_NAME = "aes:toast";

export function flashToast(message: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, tone } satisfies ToastState));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { message, tone } }));
}

export function consumeFlashToast(): ToastState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    const parsed = JSON.parse(raw) as ToastState;
    if (!parsed?.message) return null;
    return {
      message: String(parsed.message),
      tone: parsed.tone === "error" || parsed.tone === "info" ? parsed.tone : "success",
    };
  } catch {
    return null;
  }
}

export function useToast(durationMs = 3200) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function showToast(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), durationMs);
  }

  return { toast, showToast };
}

/** Host toast UI + flash/custom-event listeners (use once in a shell). */
export function useShellToast(durationMs = 3200) {
  const { toast, showToast } = useToast(durationMs);

  useEffect(() => {
    const flash = consumeFlashToast();
    if (flash) showToast(flash.message, flash.tone);

    function onEvent(event: Event) {
      const detail = (event as CustomEvent<ToastState>).detail;
      if (!detail?.message) return;
      // Clear flash so pathname remounts don't show the same toast twice.
      try {
        sessionStorage.removeItem(FLASH_KEY);
      } catch {
        /* ignore */
      }
      showToast(detail.message, detail.tone || "success");
    }
    window.addEventListener(EVENT_NAME, onEvent);
    return () => window.removeEventListener(EVENT_NAME, onEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { toast, showToast };
}

export function ToastBanner({ toast }: { toast: ToastState | null }) {
  return (
    <div
      className={toast ? `aes-toast show aes-toast-${toast.tone}` : "aes-toast"}
      role="status"
      aria-live="polite"
    >
      {toast?.message || ""}
    </div>
  );
}
