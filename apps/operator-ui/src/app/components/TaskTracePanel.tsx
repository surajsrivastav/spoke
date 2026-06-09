"use client";

import { useEffect, useState, useCallback } from "react";
import type { Task, Provenance } from "@harness/shared";
import { StatusBadge } from "./lib/StatusBadge";
import { Button } from "./lib/Button";
import { EVENT_TYPE_CONFIG } from "../lib/constants";

interface TracePanelProps {
  task: Task;
  onClose: () => void;
  onKill: () => void;
}

const MAX_GOAL_LEN = 70;

function GoalDisplay({ goal }: { goal: string }) {
  const [expanded, setExpanded] = useState(false);
  if (goal.length <= MAX_GOAL_LEN) return <div style={{ fontSize: "var(--text-h3)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, wordBreak: "break-word" }}>{goal}</div>;
  return (
    <div style={{ fontSize: "var(--text-h3)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, wordBreak: "break-word" }}>
      {expanded ? goal : goal.slice(0, MAX_GOAL_LEN) + "..."}
      <span
        onClick={() => setExpanded(!expanded)}
        style={{ color: "var(--accent-primary)", cursor: "pointer", marginLeft: 4, fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap" }}
      >
        {expanded ? "less" : "more"}
      </span>
    </div>
  );
}

export default function TaskTracePanel({ task, onClose, onKill }: TracePanelProps) {
  const [provenance, setProvenance] = useState<Provenance[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((data: any) => {
        if (data.provenance) setProvenance(data.provenance);
      })
      .catch(() => {});
  }, [task.id]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isActive = task.status === "running" || task.status === "pending";
  const estimatedCost = 0.5 + Math.random() * 4;
  const modelCost = estimatedCost * 0.87;
  const sandboxCost = estimatedCost * 0.08;
  const verifCost = estimatedCost * 0.05;

  const events: { type: keyof typeof EVENT_TYPE_CONFIG; detail: string; time: string; id: string }[] = provenance.length > 0
    ? provenance.flatMap((p, i) => {
        const t0 = new Date(p.created_at);
        const tPrev = i > 0 ? new Date(provenance[i - 1].created_at) : t0;
        const offset = Math.floor((t0.getTime() - new Date(provenance[0]?.created_at ?? t0).getTime()) / 1000);
        const timeStr = `T+${String(Math.floor(offset / 60)).padStart(2, "0")}:${String(offset % 60).padStart(2, "0")}`;

        if (p.type === "tool_called" && p.payload?.action === "provision_sandbox") {
          return [{ type: "SANDBOX_CREATED" as const, detail: `Sandbox ${p.payload.sandboxId?.slice(0, 8) || ""} provisioned`, time: timeStr, id: p.id }];
        }
        if (p.type === "tool_called" && p.payload?.action === "agent_run") {
          return [{
            type: "MODEL_CALLED" as const,
            detail: `${p.tokens || 0} tokens — $${Number(p.cost_usd || 0).toFixed(4)}`,
            time: timeStr,
            id: p.id,
          }];
        }
        if (p.type === "verification_run") {
          const passed = p.payload?.passed;
          const errors = p.payload?.errors ? Object.keys(p.payload.errors as object).filter(k => (p.payload.errors as any)[k]).join(", ") : "none";
          return [{
            type: "VERIFICATION_RAN" as const,
            detail: passed ? "All gates passed" : `Failed: ${errors || "unknown"}`,
            time: timeStr,
            id: p.id,
          }];
        }
        if (p.type === "commit_made") {
          return [{ type: "GIT_COMMITTED" as const, detail: `Branch: ${p.payload?.branch || ""}`, time: timeStr, id: p.id }];
        }
        if (p.type === "pr_opened") {
          return [{ type: "PR_CREATED" as const, detail: `${p.payload?.prUrl || ""}`, time: timeStr, id: p.id }];
        }
        return [];
      })
    : [
        { type: "TASK_STARTED" as const, detail: `Task ${task.id.slice(0, 10)} initiated by ${task.created_by}`, time: "T+00:00", id: "ev1" },
        ...(task.status === "killed" || task.status === "failed"
          ? [{ type: "TASK_KILLED" as const, detail: task.status === "killed" ? "Manual kill by operator" : `Task ${task.status}`, time: "T+00:00", id: "ev2" }]
          : []),
      ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "var(--detail-panel-width)",
        height: "100vh",
        background: "var(--bg-base)",
        borderLeft: "1px solid var(--border-subtle)",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        animation: "panelSlideIn 180ms ease-out",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--sp-5) var(--sp-5) var(--sp-3)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "Geist Mono, monospace", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              {task.id.slice(0, 12)}
            </span>
            <StatusBadge status={task.status} />
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: 16,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <GoalDisplay goal={task.goal} />
      </div>

      {/* Meta grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          background: "var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {[
          { label: "Repo", value: task.repo_url?.replace("https://github.com/", "") || "org/api" },
          { label: "Cost", value: `$${estimatedCost.toFixed(2)}`, mono: true },
          { label: "Status", value: task.status, color: "var(--status-running)" },
          { label: "Operator", value: task.created_by },
          { label: "Started", value: new Date(task.created_at).toLocaleTimeString() },
          { label: "Model", value: provenance.find(p => p.type === "tool_called" && p.payload?.action === "agent_run") ? "llama3.2:3b (Ollama)" : "—" },
        ].map((cell, i) => (
          <div
            key={i}
            style={{
              padding: "var(--sp-2) var(--sp-3)",
              background: "var(--bg-base)",
            }}
          >
            <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 2 }}>
              {cell.label}
            </div>
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: cell.color || "var(--text-primary)",
                fontFamily: cell.mono ? "Geist Mono, monospace" : undefined,
                wordBreak: "break-word",
                lineHeight: 1.4,
              }}
            >
              {cell.value}
            </div>
          </div>
        ))}
      </div>

      {/* Provenance timeline */}
      <div style={{ flex: 1, overflow: "auto", padding: "var(--sp-4) var(--sp-5)" }}>
        <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12 }}>
          Provenance
        </div>

        <div style={{ position: "relative" }}>
          {/* Connector line */}
          <div
            style={{
              position: "absolute",
              left: 9,
              top: 10,
              bottom: 10,
              width: 1,
              background: "var(--border-subtle)",
            }}
          />

          {events.map((ev, i) => {
            const evCfg = EVENT_TYPE_CONFIG[ev.type];
            const isExpanded = expanded.has(ev.id);

            return (
              <div
                key={ev.id}
                style={{
                  position: "relative",
                  paddingLeft: 28,
                  paddingBottom: i < events.length - 1 ? 16 : 0,
                  cursor: ev.type === "MODEL_CALLED" || ev.type === "TOOL_CALLED" ? "pointer" : "default",
                }}
                onClick={() => {
                  if (ev.type === "MODEL_CALLED" || ev.type === "TOOL_CALLED") toggleExpand(ev.id);
                }}
              >
                {/* Event dot */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--bg-surface)",
                    border: `1px solid ${evCfg?.color || "var(--border-default)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: evCfg?.color || "var(--text-tertiary)",
                  }}
                >
                  {evCfg?.icon || "•"}
                </div>

                {/* Event type + time */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      color: evCfg?.color || "var(--text-secondary)",
                    }}
                  >
                    {ev.type}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontFamily: "Geist Mono, monospace" }}>
                    {ev.time}
                  </span>
                </div>

                {/* Detail */}
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    fontFamily: "Geist Mono, monospace",
                    wordBreak: "break-all",
                    marginTop: 2,
                  }}
                >
                  {ev.detail}
                </div>

                {/* Expandable content */}
                {isExpanded && ev.type === "MODEL_CALLED" && (() => {
                  const p = provenance.find(pp => pp.id === ev.id);
                  return (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "var(--sp-2) var(--sp-3)",
                        background: "var(--bg-elevated)",
                        borderRadius: 6,
                        border: "1px solid var(--border-subtle)",
                        fontSize: "var(--text-xs)",
                        color: "var(--text-secondary)",
                        fontFamily: "Geist Mono, monospace",
                      }}
                    >
                      Tokens: {p?.tokens || 0} · Cost: ${Number(p?.cost_usd || 0).toFixed(4)}<br />
                      Model: llama3.2:3b (Ollama)<br />
                      Duration: {p?.duration_ms || 0}ms
                    </div>
                  );
                })()}

                {isExpanded && ev.type === "TOOL_CALLED" && (() => {
                  const p = provenance.find(pp => pp.id === ev.id);
                  const result = p?.payload?.result || "";
                  return (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "var(--sp-2) var(--sp-3)",
                        background: "var(--bg-elevated)",
                        borderRadius: 6,
                        border: "1px solid var(--border-subtle)",
                        fontSize: "var(--text-xs)",
                        color: "var(--text-secondary)",
                        fontFamily: "Geist Mono, monospace",
                        maxHeight: 120,
                        overflow: "auto",
                      }}
                    >
                      {result ? result.slice(0, 500) : "No details"}
                      {result.length > 500 ? "..." : ""}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost breakdown */}
      <div style={{ padding: "var(--sp-3) var(--sp-5)", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
          Cost Breakdown
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ width: "87%", background: "#fbbf24" }} />
          <div style={{ width: "8%", background: "#2dd4bf" }} />
          <div style={{ width: "5%", background: "#4ade80" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
          <span><span style={{ color: "#fbbf24" }}>●</span> Model ${modelCost.toFixed(2)}</span>
          <span><span style={{ color: "#2dd4bf" }}>●</span> Sandbox ${sandboxCost.toFixed(2)}</span>
          <span><span style={{ color: "#4ade80" }}>●</span> Verify ${verifCost.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer actions */}
      <div
        style={{
          padding: "var(--sp-4) var(--sp-5)",
          borderTop: "1px solid var(--border-subtle)",
          flexShrink: 0,
          display: "flex",
          gap: 8,
        }}
      >
        {isActive ? (
          <Button variant="danger" onClick={onKill} style={{ flex: 1 }}>
            ✕ Kill Task
          </Button>
        ) : (
          <>
            <Button variant="primary" style={{ flex: 1 }}>
              View PR #47 →
            </Button>
            <Button variant="ghost">Copy trace JSON</Button>
          </>
        )}
      </div>
    </div>
  );
}
