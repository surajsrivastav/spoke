import type { Task, TaskStatus } from "@spoke/shared";

const statusColors: Record<TaskStatus, string> = {
  pending: "bg-gray-200 text-gray-800",
  running: "bg-blue-200 text-blue-800",
  succeeded: "bg-green-200 text-green-800",
  failed: "bg-red-200 text-red-800",
  killed: "bg-orange-200 text-orange-800",
};

export default function TaskCard({ task }: { task: Task }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <span className="font-mono text-xs text-gray-500" title={task.id}>
          {task.id.slice(0, 8)}...
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            statusColors[task.status] ?? "bg-gray-200 text-gray-800"
          }`}
        >
          {task.status}
        </span>
      </div>
      <p className="mb-1 text-sm font-medium text-gray-900 line-clamp-2">{task.goal}</p>
      <p className="mb-2 truncate text-xs text-gray-500">{task.repo_url}</p>
      <p className="text-xs text-gray-400">
        {new Date(task.created_at).toLocaleString()}
      </p>
    </div>
  );
}
