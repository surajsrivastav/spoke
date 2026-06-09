"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Task } from "@harness/shared";
import { STATUS_CONFIG } from "../../lib/constants";

interface KillModalProps {
  task: Task;
  onClose: () => void;
  onKill: (taskId: string) => void;
}

export default function KillModal({ task, onClose, onKill }: KillModalProps) {
  const [typed, setTyped] = useState("");
  const [killing, setKilling] = useState(false);
  const [killed, setKilled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirmText = "KILL";
  const canKill = typed === confirmText && !killing;

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !killing) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [killing, onClose]);

  const handleKill = useCallback(() => {
    if (!canKill) return;
    setKilling(true);
    onKill(task.id);
    setTimeout(() => {
      setKilled(true);
      setTimeout(onClose, 1200);
    }, 800);
  }, [canKill, task.id, onKill, onClose]);

  if (killed) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.75)" }}
      >
        <div
          style={{
            background: "var(--bg-base)",
            border: "1px solid #3f1515",
            borderRadius: 12,
            width: 400,
            padding: "var(--sp-6)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, color: "var(--status-completed)", marginBottom: 12 }}>
            {"\u2713"}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--status-completed)",
              marginBottom: 4,
            }}
          >
            Task Killed
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {task.id.slice(0, 12)} has been stopped
          </div>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[task.status];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={!killing ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-describedby="kill-desc"
        style={{
          background: "var(--bg-base)",
          border: "1px solid #3f1515",
          borderRadius: 12,
          width: 400,
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--sp-5) var(--sp-6) var(--sp-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="#ef4444" strokeWidth="2" />
              <line x1="6" y1="6" x2="14" y2="14" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              <line x1="14" y1="6" x2="6" y2="14" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--status-failed)" }}>
              Kill Agent Task
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={killing}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: 16,
              padding: 4,
              opacity: killing ? 0.4 : 1,
            }}
          >
            {"\u2715"}
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "0 var(--sp-6) var(--sp-4)" }}>
          <p id="kill-desc" style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            This will immediately stop <strong style={{ color: "var(--text-primary)" }}>{task.id.slice(0, 12)}</strong>{" "}
            and destroy its E2B sandbox. This action cannot be undone.
          </p>
        </div>

        {/* Info box */}
        <div
          style={{
            margin: "0 var(--sp-6) var(--sp-4)",
            padding: "var(--sp-3) var(--sp-4)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-2)",
          }}
        >
          <div>
            <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 2 }}>
              Goal
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>
              {task.goal.length > 30 ? task.goal.slice(0, 30) + "..." : task.goal}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 2 }}>
              Cost so far
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontFamily: "Geist Mono, monospace" }}>
              $1.24
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 2 }}>
              Status
            </div>
            <div style={{ fontSize: "var(--text-sm)", fontFamily: "Geist Mono, monospace", color: cfg.color }}>
              {cfg.label}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 2 }}>
              Operator
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
              alice@ford.com
            </div>
          </div>
        </div>

        {/* Confirm input */}
        <div style={{ padding: "0 var(--sp-6) var(--sp-4)" }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 6 }}>
            Type <strong style={{ fontFamily: "Geist Mono, monospace", color: "var(--status-failed)" }}>KILL</strong> to confirm:
          </div>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            disabled={killing}
            placeholder=""
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid " + (typed === confirmText ? "var(--status-failed)" : "var(--border-subtle)"),
              borderRadius: 6,
              padding: "8px 12px",
              fontFamily: "Geist Mono, monospace",
              fontSize: 14,
              color: typed === confirmText ? "var(--status-failed)" : "var(--text-primary)",
              outline: "none",
              boxSizing: "border-box",
              opacity: killing ? 0.4 : 1,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleKill();
            }}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "var(--sp-3) var(--sp-6) var(--sp-5)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button
            onClick={onClose}
            disabled={killing}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "7px 14px",
              fontSize: "var(--text-ui)",
              fontWeight: 500,
              borderRadius: 6,
              opacity: killing ? 0.4 : 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
          <button
            onClick={handleKill}
            disabled={!canKill}
            style={{
              background: canKill ? "var(--status-failed)" : "var(--bg-elevated)",
              color: canKill ? "#fff" : "var(--text-tertiary)",
              border: "none",
              cursor: canKill ? "pointer" : "not-allowed",
              padding: "7px 14px",
              fontSize: "var(--text-ui)",
              fontWeight: 500,
              borderRadius: 6,
              transition: "all 150ms ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {killing ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Killing...
              </>
            ) : (
              "Kill Task"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
