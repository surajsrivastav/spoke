"use client";

import { useEffect, useState } from "react";
import type { Task, TaskRun } from "@spoke/shared";
import { STATUS_CONFIG } from "../../lib/constants";
import { StatusBadge, StatusDot } from "../../components/lib/StatusBadge";
import ProvenanceTree from "../../components/ProvenanceTree";

interface TaskDetail extends Task {
  task_runs: (TaskRun & {
    provenances: import("@spoke/shared").Provenance[];
  })[];
}

export default function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [killing, setKilling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tasks/${params.id}`);
        if (res.ok) {
          setTask(await res.json());
        }
      } catch {
        console.error("Failed to load task");
      } finally {
        setLoading(false);
      }
    }
    load();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${params.id}`);
        if (res.ok) {
          const updated = await res.json();
          setTask(updated);
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [params.id]);

  const isActive = task?.status === "running" || task?.status === "pending";

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Loading task...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--status-failed)" }}>Task not found.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", position: "relative" }}>
      <a
        href="/"
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--accent-primary)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 16,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 12L6 8l4-4" />
        </svg>
        Back to fleet
      </a>

      {/* Sticky kill header */}
      {isActive && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "var(--bg-base)",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "8px 0",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusDot status={task.status} pulsing />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--status-running)", fontFamily: "Geist Mono, monospace" }}>
              Agent is running
            </span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--status-running)", animation: "ping 1.5s infinite" }} />
          </div>
          <button
            onClick={async () => {
              if (killing) return;
              setKilling(true);
              try {
                const res = await fetch(`/api/tasks/${task.id}/kill`, { method: "POST" });
                if (res.ok) setTask({ ...task, status: "killed" });
              } catch {
                console.error("Failed to kill task");
              } finally {
                setKilling(false);
              }
            }}
            disabled={killing}
            style={{
              background: "var(--status-failed)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 16px",
              fontSize: "var(--text-ui)",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: killing ? 0.6 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
            {killing ? "Killing..." : "Kill Task"}
          </button>
        </div>
      )}

      {/* Task info card */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          padding: "var(--sp-5) var(--sp-6)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: "var(--text-h3)", fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>
              {task.goal}
            </h2>
            <p style={{ fontFamily: "Geist Mono, monospace", fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "4px 0 0" }}>
              {task.id}
            </p>
          </div>
          <StatusBadge status={task.status} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "var(--text-sm)" }}>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Repo: </span>
            <span style={{ color: "var(--text-primary)" }}>{task.repo_url}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Branch: </span>
            <span style={{ color: "var(--text-primary)" }}>{task.branch_target}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Created: </span>
            <span style={{ color: "var(--text-primary)" }}>{new Date(task.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Cost cap: </span>
            <span style={{ color: "var(--text-primary)" }}>${Number(task.cost_cap_usd).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: "var(--text-sub)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, letterSpacing: "-0.02em" }}>
        Task Runs ({task.task_runs.length})
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {task.task_runs.map((run) => (
          <div
            key={run.id}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "var(--sp-4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                Attempt #{run.attempt}
              </span>
              <StatusBadge status={run.status as any} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: 12 }}>
              <div>
                Cost: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>${Number(run.total_cost_usd).toFixed(4)}</span>
              </div>
              <div>
                Tokens: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{run.total_tokens}</span>
              </div>
              <div>
                Duration:{" "}
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {run.ended_at
                    ? `${Math.round(
                        (new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000
                      )}s`
                    : "running..."}
                </span>
              </div>
            </div>

            <ProvenanceTree provenances={run.provenances} />
          </div>
        ))}
      </div>

      {task.task_runs.length === 0 && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>No task runs yet.</p>
      )}
    </div>
  );
}
