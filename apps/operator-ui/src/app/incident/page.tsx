"use client";

import { useEffect, useState } from "react";
import type { Task, TaskStatus } from "@spoke/shared";

const STATUS_COLORS: Record<string, string> = {
  running: "bg-blue-500",
  succeeded: "bg-green-500",
  failed: "bg-red-500",
  killed: "bg-gray-500",
  pending: "bg-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Running",
  succeeded: "Completed",
  failed: "Failed",
  killed: "Killed",
  pending: "Pending",
};

const MOCK_EVENTS = [
  { time: "42:18", type: "TASK_FAILED", task: "task_01XYZ", detail: "Verification gate failed — 3 tests failing" },
  { time: "41:55", type: "MODEL_CALLED", task: "task_01ABC", detail: "Claude Sonnet — 1,842 tokens" },
  { time: "41:30", type: "PR_OPENED", task: "task_01MNO", detail: "github.com/org/repo/pull/142" },
  { time: "40:12", type: "TEST_FAILED", task: "task_01PQR", detail: "integration/auth.test.ts:58" },
  { time: "39:44", type: "AGENT_KILLED", task: "task_01DEF", detail: "Manual kill — cost cap exceeded" },
  { time: "38:20", type: "TASK_COMPLETED", task: "task_01GHI", detail: "PR #141 merged" },
  { time: "37:05", type: "MODEL_CALLED", task: "task_01JKL", detail: "Claude Haiku — 891 tokens" },
  { time: "35:50", type: "SANDBOX_CREATED", task: "task_01STU", detail: "E2B sandbox e2b_abc123" },
];

const MOCK_AGENTS: { id: string; status: string }[] = [];
for (let i = 0; i < 31; i++) {
  const statuses = ["running", "running", "running", "running", "running", "failed", "failed", "killed", "blocked", "blocked", "blocked", "blocked", "succeeded", "succeeded", "succeeded", "running", "running", "running", "running", "running", "running", "running", "running", "running", "running", "failed", "failed", "failed", "killed", "blocked", "blocked"];
  MOCK_AGENTS.push({ id: `agent_${String(i + 1).padStart(2, "0")}`, status: statuses[i] });
}

export default function IncidentPage() {
  const [_tasks, setTasks] = useState<Task[]>([]);
  const [events] = useState(MOCK_EVENTS);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => {});
  }, []);

  const heatmapColor = (status: string) => {
    switch (status) {
      case "running": return "bg-blue-500";
      case "succeeded": return "bg-green-500";
      case "failed": return "bg-red-500";
      case "killed": return "bg-gray-600";
      default: return "bg-gray-700";
    }
  };

  const statusCount = (s: string) =>
    MOCK_AGENTS.filter((a) => a.status === s).length;

  const summaryCards = [
    { label: "Running", count: statusCount("running"), color: "text-blue-400" },
    { label: "Failed", count: statusCount("failed"), color: "text-red-400" },
    { label: "Killed", count: statusCount("killed"), color: "text-gray-400" },
    { label: "Blocked", count: statusCount("blocked"), color: "text-yellow-400" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Incident Banner */}
      <div className="border-b border-red-900/40 bg-red-950/60 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-red-400">
              Active Incident
            </span>
            <span className="text-sm font-medium text-gray-100">
              API Latency Regression
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <span><span className="text-gray-500">Duration:</span> 42m</span>
            <span><span className="text-gray-500">Cost:</span> $38.71</span>
            <span><span className="text-gray-500">Services:</span> 7</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Agent Count + Status Summary */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">
            31 Agents Active
          </h1>
          <div className="flex gap-4">
            {summaryCards.map((s) => (
              <div key={s.label} className="text-right">
                <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.count}</div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet Heatmap */}
        <div className="mb-6">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Fleet Heatmap
          </div>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-16">
            {MOCK_AGENTS.map((agent) => (
              <div
                key={agent.id}
                className={`aspect-square rounded ${heatmapColor(agent.status)} opacity-80 hover:opacity-100 cursor-pointer transition-all`}
                title={`${agent.id} — ${agent.status}`}
              />
            ))}
          </div>
        </div>

        {/* Agent List */}
        <div className="mb-6">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Agents
          </div>
          <div className="space-y-1">
            {MOCK_AGENTS.slice(0, 8).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-2.5 text-sm"
              >
                <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[a.status] ?? "bg-gray-600"}`} />
                <span className="font-mono text-xs text-gray-300">{a.id}</span>
                <span className="ml-auto text-xs text-gray-500">{STATUS_LABELS[a.status] ?? a.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Events */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Live Events
            </span>
          </div>
          <div className="space-y-0.5">
            {events.map((ev, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded bg-gray-900/60 px-4 py-2 font-mono text-xs"
              >
                <span className="w-12 shrink-0 text-gray-600">T+{ev.time}</span>
                <span className={`shrink-0 font-semibold ${
                  ev.type.startsWith("TASK_FAILED") || ev.type === "TEST_FAILED" || ev.type === "AGENT_KILLED"
                    ? "text-red-400"
                    : ev.type === "PR_OPENED" || ev.type === "TASK_COMPLETED"
                    ? "text-green-400"
                    : "text-blue-400"
                }`}>
                  {ev.type}
                </span>
                <span className="text-gray-500">{ev.task}</span>
                <span className="ml-auto truncate text-gray-400">{ev.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
