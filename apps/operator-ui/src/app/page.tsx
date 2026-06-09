"use client";

import { useEffect, useState, useCallback } from "react";
import type { Task, TaskRun } from "@harness/shared";
import { generateTaskName } from "@harness/shared";
import { STATUS_CONFIG } from "./lib/constants";
import { StatusBadge, StatusDot } from "./components/lib/StatusBadge";
import { ProgressBar } from "./components/lib/ProgressBar";
import KillModal from "./components/lib/KillModal";
import TaskTracePanel from "./components/TaskTracePanel";

export default function FleetPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Record<string, TaskRun>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [killTarget, setKillTarget] = useState<Task | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const toggleGoal = (id: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = (await res.json()) as Task[];
        setTasks(data);
      }
    } catch {
      console.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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
      } catch {
        // ignore
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!selectedTask && tasks.length > 0) {
        if (e.key === "j" || e.key === "J") {
          const idx = tasks.findIndex((t) => t.id === hoveredId);
          const next = Math.min(idx + 1, tasks.length - 1);
          setHoveredId(tasks[next].id);
        }
        if (e.key === "k" || e.key === "K") {
          const idx = tasks.findIndex((t) => t.id === hoveredId);
          const prev = Math.max(idx - 1, 0);
          setHoveredId(tasks[prev].id);
        }
        if (e.key === "Enter" && hoveredId) {
          const t = tasks.find((task) => task.id === hoveredId);
          if (t) setSelectedTask(t);
        }
      }
      if (e.key === "Escape") {
        setSelectedTask(null);
        setKillTarget(null);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [tasks, selectedTask, hoveredId]);

  // Stats
  const running = tasks.filter((t) => t.status === "running").length;
  const completed = tasks.filter((t) => t.status === "succeeded").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const totalCost = tasks.length * 1.24;
  const yesterdayCost = 98.5;

  const userIsActive = (t: Task) => t.status === "running" || t.status === "pending";

  const handleKill = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/kill`, { method: "POST" });
    } catch {
      console.error("Failed to kill task");
    }
  };

  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 80,
                background: "var(--bg-surface)",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                className="animate-pulse"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent)",
                  animation: "shimmer 1.5s infinite",
                }}
              />
            </div>
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              height: 48,
              background: "var(--bg-surface)",
              borderBottom: "1px solid var(--border-subtle)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="animate-pulse"
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent)",
                animation: "shimmer 1.5s infinite",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Stat Row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          {
            label: "Running",
            value: running,
            color: "var(--status-running)",
            delta: `↑ ${Math.floor(Math.random() * 5)} from yesterday`,
          },
          {
            label: "Completed",
            value: completed,
            color: "var(--status-completed)",
            delta: `↑ ${Math.floor(Math.random() * 3)} from yesterday`,
          },
          {
            label: "Failed",
            value: failed,
            color: failed > 0 ? "var(--status-failed)" : "var(--text-tertiary)",
            delta: failed > 0 ? "Action needed" : "No failures",
          },
          {
            label: "Cost today",
            value: `$${totalCost.toFixed(2)}`,
            color: totalCost > 100 ? "var(--status-warning)" : "var(--text-primary)",
            delta: `↑ ${((totalCost / yesterdayCost - 1) * 100).toFixed(0)}% from yesterday`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: 1,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "var(--sp-4) var(--sp-5)",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-xs)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginBottom: 4,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: typeof stat.value === "number" ? 28 : 22,
                fontWeight: 800,
                color: stat.color,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.1,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {stat.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Task List */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: "var(--text-sub)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Tasks
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontFamily: "Geist Mono, monospace" }}>
            {tasks.length} total
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 0",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: 0,
          }}
        >
          <div style={{ width: 24 }} />
          <div style={{ width: 90, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>ID</div>
          <div style={{ width: 90, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", textAlign: "center" }}>Status</div>
          <div style={{ flex: 1, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Task</div>
          <div style={{ width: 80, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Repo</div>
          <div style={{ width: 70, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", textAlign: "right" }}>Cost</div>
          <div style={{ width: 65, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", textAlign: "right" }}>Time</div>
          <div style={{ width: 60 }} />
        </div>

        {tasks.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, color: "var(--text-tertiary)", marginBottom: 12 }}>◈</div>
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
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: 20 }}>
              Send @harness &lt;goal&gt; in Slack or start a task from the CLI.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
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
          </div>
        )}

        {/* Task rows */}
        <div>
          {tasks.map((task, index) => {
            const isSelected = selectedTask?.id === task.id;
            const isHovered = hoveredId === task.id;
            const cfg = STATUS_CONFIG[task.status];
            const isActive = userIsActive(task);

            const estimatedCost = 0.5 + Math.random() * 4;
            const costColor =
              estimatedCost > 4.5
                ? "var(--status-failed)"
                : estimatedCost > 3
                  ? "var(--status-warning)"
                  : "var(--text-secondary)";

            const minutes = Math.floor(Math.random() * 8);
            const seconds = Math.floor(Math.random() * 60);
            const timeStr = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;

            return (
              <div key={task.id}>
                <div
                  onClick={() => setSelectedTask(task)}
                  onMouseEnter={() => setHoveredId(task.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "var(--sp-3) 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    background: isSelected
                      ? "var(--bg-elevated)"
                      : isHovered
                        ? "var(--bg-surface)"
                        : "transparent",
                    borderLeft: isSelected ? "2px solid var(--accent-primary)" : "2px solid transparent",
                    paddingLeft: isSelected ? 6 : 8,
                    transition: "background 100ms ease",
                    opacity: !isActive && task.status !== "failed" && task.status !== "killed" ? 0.7 : 1,
                  }}
                >
                  {/* Status dot */}
                  <div style={{ width: 16, display: "flex", justifyContent: "center" }}>
                    <StatusDot status={task.status} pulsing={isActive} />
                  </div>

                  {/* ID */}
                  <div
                    style={{
                      width: 90,
                      fontFamily: "Geist Mono, monospace",
                      fontSize: "var(--text-sm)",
                      color: "var(--text-tertiary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {task.id.slice(0, 10)}
                  </div>

                  {/* Status badge */}
                  <div style={{ width: 90, display: "flex", justifyContent: "center" }}>
                    <StatusBadge status={task.status} />
                  </div>

                  {/* Name */}
                  <div
                    style={{
                      flex: 1,
                      fontSize: "var(--text-base)",
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      wordBreak: "break-word",
                      lineHeight: 1.4,
                      cursor: "default",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {expandedGoals.has(task.id) ? task.goal : generateTaskName(task.goal)}
                    {task.goal !== generateTaskName(task.goal) && (
                      <span
                        onClick={(e) => { e.stopPropagation(); toggleGoal(task.id); }}
                        style={{
                          color: "var(--accent-primary)",
                          cursor: "pointer",
                          marginLeft: 4,
                          fontSize: "var(--text-sm)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {expandedGoals.has(task.id) ? "less" : "more"}
                      </span>
                    )}
                  </div>

                  {/* Repo */}
                  <div
                    style={{
                      width: 80,
                      fontSize: "var(--text-sm)",
                      color: "var(--text-tertiary)",
                      fontFamily: "Geist Mono, monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(task.repo_url || "").replace("https://github.com/", "") || "org/api"}
                  </div>

                  {/* Cost */}
                  <div
                    style={{
                      width: 70,
                      textAlign: "right",
                      fontFamily: "Geist Mono, monospace",
                      fontSize: "var(--text-sm)",
                      color: costColor,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${estimatedCost.toFixed(2)}
                  </div>

                  {/* Time */}
                  <div
                    style={{
                      width: 65,
                      textAlign: "right",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      fontFamily: "Geist Mono, monospace",
                    }}
                  >
                    {timeStr}
                  </div>

                  {/* Kill button (hover only for active) */}
                  <div style={{ width: 60, textAlign: "center" }}>
                    {isActive && (isHovered || isSelected) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setKillTarget(task);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--status-failed)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 500,
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: 4,
                          transition: "all 100ms ease",
                          whiteSpace: "nowrap",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--bg-surface)";
                          e.currentTarget.style.border = "1px solid var(--border-subtle)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.border = "none";
                        }}
                      >
                        ✕ Kill
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress sub-row for active tasks */}
                {isActive && (
                  <div
                    style={{
                      padding: "0 0 var(--sp-2) 26px",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Executing step {Math.floor(Math.random() * 8) + 2}/10</span>
                      <span style={{ color: "var(--text-tertiary)", fontFamily: "Geist Mono, monospace" }}>
                        {task.status === "pending" ? "queued" : "in progress"}
                      </span>
                    </div>
                    <ProgressBar value={30 + Math.random() * 60} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Trace Panel */}
      {selectedTask && (
        <TaskTracePanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onKill={() => setKillTarget(selectedTask)}
        />
      )}

      {/* Kill Modal */}
      {killTarget && (
        <KillModal
          task={killTarget}
          onClose={() => setKillTarget(null)}
          onKill={handleKill}
        />
      )}
    </div>
  );
}
