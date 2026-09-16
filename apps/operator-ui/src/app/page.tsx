"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Task, TaskRun } from "@spoke/shared";
import { generateTaskName } from "@spoke/shared";
import { STATUS_CONFIG } from "./lib/constants";
import { StatusBadge, StatusDot } from "./components/lib/StatusBadge";
import { ProgressBar } from "./components/lib/ProgressBar";
import KillModal from "./components/lib/KillModal";
import TaskTracePanel from "./components/TaskTracePanel";

type Tab = "all" | "running" | "completed" | "failed";

const TEMPLATES = [
  { label: "Custom task", goal: "", repo: "" },
  { label: "Add UI feature", goal: "Add a dark mode toggle to the UI", repo: "https://github.com/org/spoke" },
  { label: "Write tests", goal: "Write unit tests for the API layer", repo: "https://github.com/org/spoke" },
  { label: "Fix bugs", goal: "Fix rate limiting middleware bug", repo: "https://github.com/org/spoke" },
  { label: "Create app", goal: "Create a CLI calculator application", repo: "https://github.com/org/spoke" },
];

const ESTIMATE_PER_TOKEN = 0.000015;

function estimateCost(goal: string): number {
  const words = goal.split(/\s+/).length;
  const tokens = words * 1.3;
  const modelCalls = Math.max(1, Math.ceil(words / 50));
  return tokens * ESTIMATE_PER_TOKEN * modelCalls * 3;
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "< $0.01";
  return `$${cost.toFixed(2)}`;
}

function DeltaArrow({ value }: { value: string }) {
  const isUp = value.startsWith("↑");
  const isDown = value.startsWith("↓");
  const color = isUp ? "var(--arrow-up)" : isDown ? "var(--arrow-down)" : "var(--text-tertiary)";
  const arrow = isUp ? "↑" : isDown ? "↓" : "–";
  const num = value.replace(/[↑↓]/g, "").trim();
  return (
    <span style={{ color, fontSize: "var(--text-xs)", fontVariantNumeric: "tabular-nums" }}>
      {arrow} {num}
    </span>
  );
}

export default function FleetPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Record<string, TaskRun>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [killTarget, setKillTarget] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      if (e.key === "/" && !showCreate) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
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
  }, [tasks, selectedTask, hoveredId, showCreate]);

  // Stats
  const running = tasks.filter((t) => t.status === "running").length;
  const completed = tasks.filter((t) => t.status === "succeeded").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const totalCost = tasks
    .filter((t) => new Date(t.created_at) >= startOfToday)
    .reduce((sum, t) => sum + Number(t.total_cost_usd ?? 0), 0);

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === "running") return t.status === "running" || t.status === "pending";
    if (activeTab === "completed") return t.status === "succeeded";
    if (activeTab === "failed") return t.status === "failed";
    return true;
  }).filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.id.toLowerCase().includes(q) || t.goal.toLowerCase().includes(q) || (t.repo_url || "").toLowerCase().includes(q);
  });

  const userIsActive = (t: Task) => t.status === "running" || t.status === "pending";

  const handleKill = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/kill`, { method: "POST" });
    } catch {
      console.error("Failed to kill task");
    }
  };

  const [createGoal, setCreateGoal] = useState("");
  const [createRepo, setCreateRepo] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  const handleCreateTask = useCallback(async () => {
    if (!createGoal.trim() || !createRepo.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: createGoal.trim(), repo_url: createRepo.trim() }),
      });
      setShowCreate(false);
      setCreateGoal("");
      setCreateRepo("");
      setSelectedTemplate(null);
      fetchTasks();
    } catch {
      console.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  }, [createGoal, createRepo, fetchTasks]);

  const selectTemplate = (idx: number) => {
    const t = TEMPLATES[idx];
    setSelectedTemplate(idx);
    setCreateGoal(t.goal);
    setCreateRepo(t.repo);
  };

  const estimatedCost = createGoal.trim() ? estimateCost(createGoal) : null;

  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 72,
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
              height: 44,
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
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[
          {
            label: "Running",
            value: running,
            color: "var(--status-running)",
            delta: running > 0 ? `↑ ${running} active` : "– idle",
          },
          {
            label: "Completed",
            value: completed,
            color: "var(--status-completed)",
            delta: `– ${tasks.length} total`,
          },
          {
            label: "Failed",
            value: failed,
            color: failed > 0 ? "var(--status-failed)" : "var(--text-tertiary)",
            delta: failed > 0 ? "↑ Action needed" : "– 0",
          },
          {
            label: "Cost today",
            value: `$${totalCost.toFixed(2)}`,
            color: totalCost > 100 ? "var(--status-warning)" : "var(--text-primary)",
            delta: `– ${startOfToday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: 1,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "var(--sp-3) var(--sp-4)",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-xs)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginBottom: 2,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: typeof stat.value === "number" ? 24 : 18,
                fontWeight: 800,
                color: stat.color,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.1,
              }}
            >
              {stat.value}
            </div>
            <div style={{ marginTop: 2 }}>
              <DeltaArrow value={stat.delta} />
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
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                fontSize: "var(--text-sub)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Tasks
            </span>
            <div style={{ display: "flex", gap: 2, background: "var(--bg-surface)", borderRadius: 6, border: "1px solid var(--border-subtle)", padding: 2 }}>
              {(["all", "running", "completed", "failed"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? "var(--accent-primary)" : "transparent",
                    color: activeTab === tab ? "#fff" : "var(--text-tertiary)",
                    border: "none",
                    borderRadius: 4,
                    padding: "3px 10px",
                    fontSize: "var(--text-xs)",
                    fontWeight: 500,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 100ms ease",
                  }}
                >
                  {tab === "all" ? "All" : tab}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search tasks... (press "/")'
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: "var(--text-xs)",
                color: "var(--text-primary)",
                outline: "none",
                width: 180,
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={() => setShowCreate(true)}
              style={{
                background: "var(--accent-primary)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              + New Task
            </button>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontFamily: "Geist Mono, monospace" }}>
              {filteredTasks.length}/{tasks.length}
            </span>
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 0 5px 8px",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: 0,
          }}
        >
          <div style={{ width: 16 }} />
          <div style={{ width: 90, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>ID</div>
          <div style={{ width: 80, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", textAlign: "center" }}>Status</div>
          <div style={{ flex: 1, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Task</div>
          <div style={{ width: 100, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Source</div>
          <div style={{ width: 80, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Repo</div>
          <div style={{ width: 65, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", textAlign: "right" }}>Cost</div>
          <div style={{ width: 60, fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", textAlign: "right" }}>Time</div>
          <div style={{ width: 55 }} />
        </div>

        {filteredTasks.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, color: "var(--text-tertiary)", marginBottom: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <div
              style={{
                fontSize: "var(--text-h3)",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 8,
              }}
            >
              {searchQuery ? "No matching tasks" : "No active tasks"}
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: 20 }}>
              {searchQuery ? "Try a different search term" : "Create a task above or submit one through the API."}
            </div>
            {!searchQuery && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                <button
                  onClick={() => setShowCreate(true)}
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
            )}
          </div>
        )}

        {/* Task rows */}
        <div>
          {filteredTasks.map((task) => {
            const isSelected = selectedTask?.id === task.id;
            const isHovered = hoveredId === task.id;
            const cfg = STATUS_CONFIG[task.status];
            const isActive = userIsActive(task);

            const taskCost = Number(task.total_cost_usd ?? 0);
            const capValue = Number(task.cost_cap_usd) || 5;
            const costColor =
              taskCost > capValue * 0.9
                ? "var(--status-failed)"
                : taskCost > capValue * 0.6
                  ? "var(--status-warning)"
                  : "var(--text-secondary)";

            const endTime = task.completed_at ?? task.updated_at;
            const elapsedMs = Math.max(new Date(endTime).getTime() - new Date(task.created_at).getTime(), 0);
            const minutes = Math.floor(elapsedMs / 60_000);
            const seconds = Math.floor((elapsedMs % 60_000) / 1000);
            const timeStr = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;

            const source = task.created_by === "demo" ? "API" : /^U[A-Z0-9_]+$/.test(task.created_by) ? "Slack" : /^\+?\d{7,}$/.test(task.created_by) ? "WhatsApp" : "API";

            const taskLabel = generateTaskName(task.goal);
            const nameIsTruncated = taskLabel !== task.goal;

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
                    padding: "8px 0 8px 8px",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    background: isSelected
                      ? "var(--bg-elevated)"
                      : isHovered
                        ? "var(--bg-surface)"
                        : "transparent",
                    borderLeft: isSelected ? "2px solid var(--accent-primary)" : "2px solid transparent",
                    transition: "background 100ms ease",
                    opacity: !isActive && task.status !== "failed" && task.status !== "killed" ? 0.7 : 1,
                  }}
                >
                  <div style={{ width: 16, display: "flex", justifyContent: "center" }}>
                    <StatusDot status={task.status} pulsing={isActive} />
                  </div>

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
                    title={task.id}
                  >
                    {task.id.slice(0, 10)}
                  </div>

                  <div style={{ width: 80, display: "flex", justifyContent: "center" }}>
                    <StatusBadge status={task.status} />
                  </div>

                  <div
                    style={{
                      flex: 1,
                      fontSize: "var(--text-base)",
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      lineHeight: 1.4,
                      cursor: "default",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title={nameIsTruncated ? task.goal : undefined}
                  >
                    {taskLabel}
                  </div>

                  <div
                    style={{
                      width: 100,
                      fontSize: "var(--text-sm)",
                      color: "var(--text-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: source === "Slack" ? "#4a154b" : source === "WhatsApp" ? "#25D366" : "var(--text-tertiary)",
                        flexShrink: 0,
                      }}
                    />
                    {source}
                  </div>

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
                    title={task.repo_url || ""}
                  >
                    {(task.repo_url || "").replace("https://github.com/", "") || "org/api"}
                  </div>

                  <div
                    style={{
                      width: 65,
                      textAlign: "right",
                      fontFamily: "Geist Mono, monospace",
                      fontSize: "var(--text-sm)",
                      color: costColor,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${taskCost.toFixed(2)}
                  </div>

                  <div
                    style={{
                      width: 60,
                      textAlign: "right",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      fontFamily: "Geist Mono, monospace",
                    }}
                  >
                    {timeStr}
                  </div>

                  <div style={{ width: 55, textAlign: "center" }}>
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
                          e.currentTarget.style.background = "var(--bg-overlay)";
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

                {isActive && (
                  <div
                    style={{
                      padding: "0 0 6px 26px",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span>{task.status === "pending" ? "Queued — waiting for worker..." : "Running..."}</span>
                      <span style={{ color: "var(--text-tertiary)", fontFamily: "Geist Mono, monospace" }}>
                        {task.status === "pending" ? "queued" : "in progress"}
                      </span>
                    </div>
                    <ProgressBar value={task.status === "pending" ? 5 : 40} />
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

      {/* Create Task Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              width: 520,
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--sp-5) var(--sp-6) var(--sp-3)",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                New Task
              </span>
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  fontSize: 16,
                  padding: 4,
                  opacity: creating ? 0.4 : 1,
                }}
              >
                {"\u2715"}
              </button>
            </div>

            {/* Templates */}
            <div style={{ padding: "0 var(--sp-6) var(--sp-3)" }}>
              <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 6 }}>
                Quick templates
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => selectTemplate(i)}
                    style={{
                      background: selectedTemplate === i ? "var(--accent-glow)" : "var(--bg-surface)",
                      border: selectedTemplate === i ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: "var(--text-xs)",
                      color: selectedTemplate === i ? "var(--accent-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "all 100ms ease",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: "0 var(--sp-6) var(--sp-4)", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label
                  htmlFor="create-goal"
                  style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}
                >
                  Goal
                </label>
                <input
                  id="create-goal"
                  value={createGoal}
                  onChange={(e) => {
                    setCreateGoal(e.target.value);
                    setSelectedTemplate(null);
                  }}
                  placeholder="e.g. Add a health check endpoint to the API"
                  disabled={creating}
                  autoFocus
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 14,
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="create-repo"
                  style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 4, display: "block" }}
                >
                  Repo URL
                </label>
                <input
                  id="create-repo"
                  value={createRepo}
                  onChange={(e) => setCreateRepo(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  disabled={creating}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 14,
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateTask(); }}
                />
              </div>
              {estimatedCost !== null && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 4.5v1" />
                    <path d="M8 10.5v1" />
                    <path d="M6 8h4" />
                  </svg>
                  Estimated cost: <strong>{formatCost(estimatedCost)}</strong>
                </div>
              )}
            </div>
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
                onClick={() => {
                  setShowCreate(false);
                  setSelectedTemplate(null);
                }}
                disabled={creating}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  padding: "7px 14px",
                  fontSize: "var(--text-ui)",
                  fontWeight: 500,
                  borderRadius: 6,
                  opacity: creating ? 0.4 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={creating || !createGoal.trim() || !createRepo.trim()}
                style={{
                  background: !createGoal.trim() || !createRepo.trim() ? "var(--bg-elevated)" : "var(--accent-primary)",
                  color: !createGoal.trim() || !createRepo.trim() ? "var(--text-tertiary)" : "#fff",
                  border: "none",
                  cursor: !createGoal.trim() || !createRepo.trim() ? "not-allowed" : "pointer",
                  padding: "7px 14px",
                  fontSize: "var(--text-ui)",
                  fontWeight: 500,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {creating ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
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
