"use client";

import { useEffect, useState, useCallback } from "react";
import type { Task, Provenance } from "@spoke/shared";
import { generateTaskName } from "@spoke/shared";
import { STATUS_CONFIG, EVENT_TYPE_CONFIG } from "../lib/constants";
import { StatusBadge, StatusDot } from "../components/lib/StatusBadge";

function formatOffset(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `T+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useEvents(taskId: string | null) {
  const [provenance, setProvenance] = useState<Provenance[]>([]);

  useEffect(() => {
    if (!taskId) { setProvenance([]); return; }
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((data: any) => {
        if (data.provenance) setProvenance(data.provenance);
      })
      .catch(() => {});
  }, [taskId]);

  return provenance;
}

interface TimelineEvent {
  type: keyof typeof EVENT_TYPE_CONFIG;
  detail: string;
  time: string;
  id: string;
}

function buildEvents(task: Task, provenance: Provenance[]): TimelineEvent[] {
  if (provenance.length > 0) {
    return provenance.flatMap<TimelineEvent>((p, i) => {
      const t0 = new Date(p.created_at);
      const base = new Date(provenance[0].created_at);
      const offset = Math.floor((t0.getTime() - base.getTime()) / 1000);
      const timeStr = formatOffset(offset);

      if (p.type === "tool_called" && p.payload?.action === "provision_sandbox") {
        const sid = String(p.payload.sandboxId ?? "");
        return [{ type: "SANDBOX_CREATED" as const, detail: `Sandbox ${sid.slice(0, 8)} provisioned`, time: timeStr, id: p.id }];
      }
      if (p.type === "tool_called" && p.payload?.action === "agent_run") {
        return [{ type: "MODEL_CALLED" as const, detail: `${p.tokens} tokens — $${Number(p.cost_usd).toFixed(4)}`, time: timeStr, id: p.id }];
      }
      if (p.type === "verification_run") {
        const errors = p.payload?.errors ? Object.keys(p.payload.errors as object).filter(k => (p.payload.errors as Record<string, boolean>)[k]).join(", ") : "none";
        return [{ type: "VERIFICATION_RAN" as const, detail: p.payload?.passed ? "All gates passed" : `Failed: ${errors || "unknown"}`, time: timeStr, id: p.id }];
      }
      if (p.type === "commit_made") {
        return [{ type: "GIT_COMMITTED" as const, detail: `Branch: ${p.payload?.branch ?? ""}`, time: timeStr, id: p.id }];
      }
      if (p.type === "pr_opened") {
        return [{ type: "PR_CREATED" as const, detail: `${p.payload?.prUrl ?? ""}`, time: timeStr, id: p.id }];
      }
      return [];
    });
  }

  return [
    { type: "TASK_STARTED" as const, detail: `Task ${task.id.slice(0, 10)} initiated by ${task.created_by}`, time: "T+00:00", id: "ev1" },
    ...(task.status === "killed" || task.status === "failed"
      ? [{ type: "TASK_KILLED" as const, detail: task.status === "killed" ? "Manual kill by operator" : `Task ${task.status}`, time: "T+00:00", id: "ev2" }]
      : []),
  ];
}

export default function TracePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;
  const provenance = useEvents(selectedId);
  const events = selectedTask ? buildEvents(selectedTask, provenance) : [];

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: Task[]) => {
        setTasks(data);
        const running = data.find((t) => t.status === "running" || t.status === "pending");
        if (running) setSelectedId(running.id);
        else if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const es = new EventSource("/api/events");
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "init") {
          setTasks(msg.tasks);
        } else if (msg.type === "update") {
          setTasks((prev) => {
            const updated = [...prev];
            for (const u of msg.tasks) {
              const idx = updated.findIndex((t) => t.id === u.id);
              if (idx >= 0) updated[idx] = u;
              else updated.unshift(u);
            }
            return updated;
          });
        }
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  const isActive = selectedTask?.status === "running" || selectedTask?.status === "pending";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: "var(--text-sub)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 4 }}>
          Trace
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontFamily: "Geist Mono, monospace" }}>
          {tasks.length} tasks · {provenance.length} provenance events
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 140px)" }}>
        {/* Task selector sidebar */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            background: "var(--bg-surface)",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            overflow: "auto",
          }}
        >
          {loading ? (
            <div style={{ padding: 16, fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Loading...</div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: 16, fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>No tasks</div>
          ) : (
            tasks.map((task) => {
              const isSel = selectedId === task.id;
              const cfg = STATUS_CONFIG[task.status];
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedId(task.id)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderLeft: isSel ? "2px solid var(--accent-primary)" : "2px solid transparent",
                    background: isSel ? "var(--bg-elevated)" : "transparent",
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background 100ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <StatusDot status={task.status} pulsing={isSel && (task.status === "running" || task.status === "pending")} />
                    <span style={{ fontFamily: "Geist Mono, monospace", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                      {task.id.slice(0, 10)}
                    </span>
                    <span style={{ marginLeft: "auto" }}>
                      <StatusBadge status={task.status} />
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.3, wordBreak: "break-word" }}>
                    {generateTaskName(task.goal)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Main trace area */}
        <div
          style={{
            flex: 1,
            background: "var(--bg-surface)",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!selectedTask ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, color: "var(--text-tertiary)", marginBottom: 12 }}>◎</div>
                <div style={{ fontSize: "var(--text-h3)", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Select a task to view its trace
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Task header */}
              <div style={{ padding: "var(--sp-5) var(--sp-5) var(--sp-3)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                    {selectedTask.id.slice(0, 12)}
                  </span>
                  <StatusBadge status={selectedTask.status} />
                  {isActive && (
                    <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--status-running)", display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--status-running)", animation: "ping 1.5s infinite" }} />
                      Live
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "var(--text-h3)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, wordBreak: "break-word" }}>
                  {selectedTask.goal}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                  <span>{selectedTask.repo_url?.replace("https://github.com/", "") || "org/api"}</span>
                  <span>{new Date(selectedTask.created_at).toLocaleString()}</span>
                  <span>{selectedTask.created_by}</span>
                </div>
              </div>

              {/* Provenance timeline */}
              <div style={{ flex: 1, overflow: "auto", padding: "var(--sp-5)" }}>
                <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 16 }}>
                  Provenance ({events.length} events)
                </div>

                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 9, top: 10, bottom: 10, width: 1, background: "var(--border-subtle)" }} />

                  {events.map((ev, i) => {
                    const evCfg = EVENT_TYPE_CONFIG[ev.type];
                    return (
                      <div key={ev.id} style={{ position: "relative", paddingLeft: 28, paddingBottom: i < events.length - 1 ? 16 : 0 }}>
                        <div style={{ position: "absolute", left: 0, top: 3, width: 20, height: 20, borderRadius: "50%", background: "var(--bg-surface)", border: `1px solid ${evCfg?.color || "var(--border-default)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: evCfg?.color || "var(--text-tertiary)" }}>
                          {evCfg?.icon || "•"}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "var(--text-xs)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, color: evCfg?.color || "var(--text-secondary)" }}>
                            {ev.type}
                          </span>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontFamily: "Geist Mono, monospace" }}>
                            {ev.time}
                          </span>
                        </div>

                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontFamily: "Geist Mono, monospace", wordBreak: "break-all", marginTop: 2 }}>
                          {ev.detail}
                        </div>
                      </div>
                    );
                  })}

                  {events.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
                      No provenance events recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
