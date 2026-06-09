"use client";

import { useState } from "react";

const STEPS = [
  { num: "01", label: "Connect your Slack workspace", cta: "Connect →", done: true },
  { num: "02", label: "Add your GitHub token", cta: "Configure →", done: false },
  { num: "03", label: "Set your cost cap", cta: "Set cap →", done: false },
  { num: "04", label: "Run your first task", cta: "Run now →", done: false },
];

export default function EmptyPage() {
  const [steps, setSteps] = useState(STEPS);

  const toggleStep = (i: number) => {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s)),
    );
  };

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
      {/* Empty state */}
      <div style={{ fontSize: 40, color: "var(--text-tertiary)", marginBottom: 16 }}>◈</div>
      <div
        style={{
          fontSize: "var(--text-h3)",
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: 8,
        }}
      >
        No active tasks
      </div>
      <div
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
          marginBottom: 24,
          lineHeight: 1.6,
        }}
      >
        Send @harness &lt;goal&gt; in Slack
        <br />
        or start a task from the CLI.
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 48 }}>
        <button
          style={{
            background: "var(--accent-primary)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "7px 14px",
            fontSize: "var(--text-ui)",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + New Task
        </button>
        <button
          style={{
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            padding: "7px 14px",
            fontSize: "var(--text-ui)",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          View docs →
        </button>
      </div>

      {/* Onboarding steps */}
      <div style={{ textAlign: "left" }}>
        <div
          style={{
            fontSize: "var(--text-xs)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            marginBottom: 16,
          }}
        >
          Getting Started
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {steps.map((step, i) => (
            <div
              key={step.num}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "var(--sp-3) var(--sp-4)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                cursor: "pointer",
                opacity: step.done ? 0.6 : 1,
                transition: "all 100ms ease",
              }}
              onClick={() => toggleStep(i)}
            >
              <div
                style={{
                  fontSize: "var(--text-sub)",
                  fontWeight: 700,
                  color: step.done ? "var(--status-completed)" : "var(--accent-primary)",
                  width: 24,
                }}
              >
                {step.done ? "✓" : step.num}
              </div>
              <div
                style={{
                  flex: 1,
                  fontSize: "var(--text-base)",
                  color: step.done ? "var(--text-tertiary)" : "var(--text-primary)",
                  textDecoration: step.done ? "line-through" : "none",
                }}
              >
                {step.label}
              </div>
              <button
                style={{
                  background: step.done
                    ? "transparent"
                    : "var(--accent-primary)",
                  color: step.done
                    ? "var(--text-secondary)"
                    : "#fff",
                  border: step.done
                    ? "1px solid var(--border-default)"
                    : "none",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {step.done ? "Done" : step.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
