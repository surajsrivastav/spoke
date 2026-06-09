import type { TaskStatus } from "@spoke/shared";

export const STATUS_CONFIG: Record<
  TaskStatus,
  { color: string; label: string; bg: string; border: string }
> = {
  pending: {
    color: "#6b7280",
    label: "Pending",
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.2)",
  },
  running: {
    color: "#3b82f6",
    label: "Running",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.2)",
  },
  succeeded: {
    color: "#22c55e",
    label: "Completed",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.2)",
  },
  failed: {
    color: "#ef4444",
    label: "Failed",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.2)",
  },
  killed: {
    color: "#6b7280",
    label: "Killed",
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.2)",
  },
};

export const EVENT_TYPE_CONFIG: Record<
  string,
  { color: string; icon: string }
> = {
  TASK_STARTED: { color: "#60a5fa", icon: "▶" },
  SANDBOX_CREATED: { color: "#2dd4bf", icon: "□" },
  REPO_CLONED: { color: "#a78bfa", icon: "⑂" },
  MODEL_CALLED: { color: "#fbbf24", icon: "◇" },
  PLAN_CREATED: { color: "#818cf8", icon: "◎" },
  TOOL_CALLED: { color: "#94a3b8", icon: "⚙" },
  VERIFICATION_RAN: { color: "#4ade80", icon: "✓" },
  GIT_COMMITTED: { color: "#fb923c", icon: "⬆" },
  PR_CREATED: { color: "#22c55e", icon: "○" },
  TASK_KILLED: { color: "#f87171", icon: "✕" },
};

export const NAV_ITEMS = [
  { id: "fleet", label: "Fleet", icon: "◇", href: "/" },
  { id: "trace", label: "Trace", icon: "◎", href: "/trace" },
  { id: "costs", label: "Costs", icon: "⟐", href: "/cost" },
  { id: "sso", label: "SSO", icon: "◈", href: "/sso" },
  { id: "settings", label: "Settings", icon: "✦", href: "/settings" },
];
