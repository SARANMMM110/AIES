"use client";

export function InstructionPanel({
  instruction,
  onChange,
}: {
  instruction: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="section-heading">
        <h2>Prepared instruction</h2>
        <button
          type="button"
          className="btn ghost"
          disabled={!instruction}
          onClick={() => void navigator.clipboard.writeText(instruction)}
        >
          Copy
        </button>
      </div>
      <textarea
        className="instruction-box"
        rows={12}
        value={instruction}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Generated instruction appears here…"
      />
    </div>
  );
}

const AI_LINKS: Array<{ label: string; url: string }> = [
  { label: "ChatGPT", url: "https://chatgpt.com/" },
  { label: "Claude", url: "https://claude.ai/" },
  { label: "Gemini", url: "https://gemini.google.com/" },
];

export function ExternalAIButtons({
  instruction,
  preferred,
}: {
  instruction: string;
  preferred?: string | null;
}) {
  return (
    <div className="external-ai-row">
      <button
        type="button"
        className="btn"
        disabled={!instruction}
        onClick={() => void navigator.clipboard.writeText(instruction)}
      >
        Copy instruction
      </button>
      {AI_LINKS.map((link) => (
        <a
          key={link.label}
          className={
            preferred && preferred.toLowerCase().includes(link.label.toLowerCase())
              ? "btn"
              : "btn ghost"
          }
          href={link.url}
          target="_blank"
          rel="noreferrer"
        >
          Open {link.label}
        </a>
      ))}
      <p className="muted" style={{ width: "100%", margin: "0.35rem 0 0" }}>
        No API keys are used. Run the instruction externally, then paste the response for review.
      </p>
    </div>
  );
}

export function WorkflowProgress({
  step,
}: {
  step: number;
}) {
  const steps = ["Context", "Inputs", "Prepare", "Run", "Review", "Save"];
  return (
    <div className="step-rail" aria-label="Workflow progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const cls =
          n === step ? "step-pill active" : n < step ? "step-pill done" : "step-pill";
        return (
          <span key={label} className={cls}>
            {String(n).padStart(2, "0")} {label}
          </span>
        );
      })}
    </div>
  );
}
