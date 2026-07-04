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

const ESTIMATE_PER_TOKEN = 0.000015;

function estimateCost(goal: string): number {
  const words = goal.split(/\s+/).length;
  const tokens = words * 1.3;
  const modelCalls = Math.max(1, Math.ceil(words / 50));
  return +(tokens * ESTIMATE_PER_TOKEN * modelCalls * 3).toFixed(2);
}

function DeltaArrow({ value }: { value: string }) {
  const isUp = value.startsWith("↑");
  const isDown = value.startsWith("↓");
  const color = isUp ? "green" : isDown ? "red" : "gray";
  return <span style={{ color }}>{value}</span>;
}

export default function FleetPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchTasks = async () => {
    const response = await fetch("/api/tasks");
    const data = await response.json();
    setTasks(data);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div>
      <h1>Tasks</h1>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id}>
              <td>{task.label}</td>
              <td><StatusBadge status={task.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Other components here... */}

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