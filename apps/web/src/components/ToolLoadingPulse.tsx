"use client";

type Props = {
  /** Optional label for screen readers only */
  label?: string;
  /** Optional override glyph. Defaults to the AES application mark. */
  icon?: string | null;
  fullPage?: boolean;
};

export function ToolLoadingPulse({
  label = "Loading",
  icon,
  fullPage = true,
}: Props) {
  const glyph = (icon || "AES").trim().slice(0, 3) || "AES";

  return (
    <div
      className={`tool-loading-pulse${fullPage ? " tool-loading-pulse--page" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="tool-loading-pulse-mark" aria-hidden>
        <span className="tool-loading-pulse-glyph">{glyph}</span>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
