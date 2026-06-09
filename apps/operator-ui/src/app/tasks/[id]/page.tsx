"use client";

import { useEffect, useState } from "react";
import type { Task, TaskRun } from "@harness/shared";
import ProvenanceTree from "../../components/ProvenanceTree";

interface TaskDetail extends Task {
  task_runs: (TaskRun & {
    provenances: import("@harness/shared").Provenance[];
  })[];
}

const runStatusColors: Record<string, string> = {
  provisioning: "bg-gray-100 text-gray-700",
  planning: "bg-blue-100 text-blue-700",
  executing: "bg-indigo-100 text-indigo-700",
  verifying: "bg-purple-100 text-purple-700",
  pushing: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  killed: "bg-orange-100 text-orange-700",
};

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
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading task...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">Task not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <a href="/" className="text-sm text-blue-600 hover:underline">
        &larr; Back to fleet
      </a>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{task.goal}</h2>
            <p className="mt-1 font-mono text-xs text-gray-400">{task.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
              {task.status}
            </span>
            {task.status === "running" && (
              <button
                onClick={async () => {
                  if (killing) return;
                  setKilling(true);
                  try {
                    const res = await fetch(`/api/tasks/${task.id}/kill`, {
                      method: "POST",
                    });
                    if (res.ok) {
                      setTask({ ...task, status: "killed" });
                    }
                  } catch {
                    console.error("Failed to kill task");
                  } finally {
                    setKilling(false);
                  }
                }}
                disabled={killing}
                className="rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {killing ? "Killing..." : "Kill"}
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Repo:</span>{" "}
            <span className="text-gray-900">{task.repo_url}</span>
          </div>
          <div>
            <span className="text-gray-500">Branch:</span>{" "}
            <span className="text-gray-900">{task.branch_target}</span>
          </div>
          <div>
            <span className="text-gray-500">Created:</span>{" "}
            <span className="text-gray-900">
              {new Date(task.created_at).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Cost cap:</span>{" "}
            <span className="text-gray-900">
              ${Number(task.cost_cap_usd).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <h3 className="mb-4 mt-8 text-lg font-semibold text-gray-900">
        Task Runs ({task.task_runs.length})
      </h3>

      <div className="space-y-4">
        {task.task_runs.map((run) => (
          <div
            key={run.id}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Attempt #{run.attempt}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  runStatusColors[run.status] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {run.status}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-3 text-xs text-gray-500">
              <div>
                Cost: <span className="font-medium text-gray-700">${Number(run.total_cost_usd).toFixed(4)}</span>
              </div>
              <div>
                Tokens: <span className="font-medium text-gray-700">{run.total_tokens}</span>
              </div>
              <div>
                Duration:{" "}
                <span className="font-medium text-gray-700">
                  {run.ended_at
                    ? `${Math.round(
                        (new Date(run.ended_at).getTime() -
                          new Date(run.started_at).getTime()) /
                          1000,
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
        <p className="text-sm text-gray-400">No task runs yet.</p>
      )}
    </div>
  );
}
