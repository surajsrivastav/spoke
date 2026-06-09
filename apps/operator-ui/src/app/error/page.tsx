"use client";

import { useState } from "react";
import { StatusBadge } from "../components/lib/StatusBadge";

const FAILED_TASK = {
  id: "task_01ABC",
  goal: "Add JWT authentication to Express API",
  status: "failed" as const,
  repo_url: "https://github.com/org/api",
  branch_target: "main",
  cost_cap_usd: 5.0,
  created_by: "alice@ford.com",
  created_at: new Date(),
  updated_at: new Date(),
  completed_at: null,
};

export default function ErrorPage() {
  const [toasts] = useState([
    { type: "error", message: "Cost cap exceeded ($5.00 limit reached). Task terminated." },
    { type: "warning", message: "3 tasks near cost cap" },
    { type: "success", message: "Task task_02DEF completed successfully" },
  ]);

  return (
    <div>
      {/* Inline error banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#ef4444" strokeWidth="1.5" />
          <line x1="8" y1="5" x2="8" y2="9" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="1" fill="#ef4444" />
        </svg>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--status-failed)", fontWeight: 500 }}>
          API Error: Failed to fetch task data. Retrying...
        </span>
        <button
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: 12,
            padding: 4,
          }}
        >
          Dismiss
        </button>
      </div>

      {/* Task row showing failed state */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "var(--sp-3) 0",
            borderBottom: "1px solid var(--border-subtle)",
            borderLeft: "2px solid var(--status-failed)",
            paddingLeft: 6,
            background: "rgba(239,68,68,0.03)",
          }}
        >
          <div style={{ width: 16, display: "flex", justifyContent: "center" }}>
            <span
              className="relative flex h-2 w-2"
              style={{ color: "var(--status-failed)" }}
            >
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
                style={{ backgroundColor: "var(--status-failed)", animationDuration: "1.5s" }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--status-failed)" }}
              />
            </span>
          </div>
          <div
            style={{
              width: 90,
              fontFamily: "Geist Mono, monospace",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
            }}
          >
            task_01ABC
          </div>
          <div style={{ width: 90 }}>
            <StatusBadge status="failed" />
          </div>
          <div
            style={{
              flex: 1,
              fontSize: "var(--text-base)",
              color: "var(--text-primary)",
              fontWeight: 500,
            }}
          >
            {FAILED_TASK.goal}
          </div>
          <div style={{ width: 80, fontSize: "var(--text-sm)", color: "var(--text-tertiary)", fontFamily: "Geist Mono" }}>
            org/api
          </div>
          <div
            style={{
              width: 70,
              textAlign: "right",
              fontFamily: "Geist Mono, monospace",
              fontSize: "var(--text-sm)",
              color: "var(--status-failed)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            $4.82
          </div>
          <div
            style={{
              width: 65,
              textAlign: "right",
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              fontFamily: "Geist Mono, monospace",
            }}
          >
            3m 12s
          </div>
        </div>

        {/* Error detail */}
        <div
          style={{
            marginTop: 4,
            marginLeft: 26,
            padding: "var(--sp-2) var(--sp-3)",
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 6,
            fontSize: "var(--text-xs)",
            color: "var(--status-failed)",
            fontFamily: "Geist Mono, monospace",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⛔ Task Failed — Cost Cap Exceeded</div>
          <div style={{ color: "var(--text-secondary)" }}>
            Task consumed $5.02 of $5.00 limit at step 7/10 (verification).
            <br />
            Model calls: 12 (84%) · Sandbox: 4m 12s (12%) · Verification: 2m 3s (4%)
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 100,
        }}
      >
        {toasts.map((toast, i) => {
          const borderColor =
            toast.type === "error"
              ? "var(--status-failed)"
              : toast.type === "warning"
                ? "var(--status-warning)"
                : "var(--status-completed)";
          return (
            <div
              key={i}
              style={{
                width: 280,
                padding: "10px 14px",
                background: "var(--bg-surface)",
                border: `1px solid ${borderColor}`,
                borderLeft: `3px solid ${borderColor}`,
                borderRadius: 8,
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                animation: "toastSlideIn 180ms ease-out",
              }}
            >
              {toast.message}
            </div>
          );
        })}
      </div>
    </div>
  );
}
