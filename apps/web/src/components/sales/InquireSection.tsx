"use client";

import type { ReactNode } from "react";
import "./inquiry-form.css";

type Props = {
  kicker?: string;
  title: ReactNode;
  description: string;
  bullets?: string[];
  children: ReactNode;
  id?: string;
  className?: string;
};

export function InquireSection({
  kicker = "Purchase",
  title,
  description,
  bullets,
  children,
  id = "purchase",
  className,
}: Props) {
  const root = ["aes-inquire", className].filter(Boolean).join(" ");
  return (
    <section className={root} id={id}>
      <div className="container aes-inquire-grid">
        <div className="aes-inquire-copy">
          <p className="aes-inquire-kicker">{kicker}</p>
          <h2>{title}</h2>
          <p>{description}</p>
          {bullets?.length ? (
            <ul className="aes-inquire-list">
              {bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="aes-inquire-panel">{children}</div>
      </div>
    </section>
  );
}
