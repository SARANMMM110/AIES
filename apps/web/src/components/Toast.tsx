"use client";

import { useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export function useToast(durationMs = 2800) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
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

export function ToastBanner({
  toast,
}: {
  toast: { message: string; tone: ToastTone } | null;
}) {
  if (!toast) return <div className="aes-toast" role="status" aria-live="polite" />;
  return (
    <div className={`aes-toast show aes-toast-${toast.tone}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}
