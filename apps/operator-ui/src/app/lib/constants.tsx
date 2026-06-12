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

function FleetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function TraceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="4" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="8" cy="12" r="2" />
      <line x1="5.5" y1="5.5" x2="6.5" y2="7" />
      <line x1="10.5" y1="5.5" x2="9.5" y2="7" />
    </svg>
  );
}

function CostsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="1" x2="8" y2="15" />
      <polyline points="4,7 8,3 12,7" />
      <polyline points="4,9 8,13 12,9" />
    </svg>
  );
}

function SSOIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L2.5 4v3.5C2.5 11.5 5.5 14.5 8 15c2.5-0.5 5.5-3.5 5.5-7.5V4L8 1.5z" />
      <path d="M6 8l1.5 1.5L10.5 6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v2" />
      <path d="M8 12.5v2" />
      <path d="M14.5 8h-2" />
      <path d="M3.5 8h-2" />
      <path d="M12 4l-1.5 1.5" />
      <path d="M5.5 10.5L4 12" />
      <path d="M12 12l-1.5-1.5" />
      <path d="M5.5 5.5L4 4" />
    </svg>
  );
}

export const NAV_ITEM_ICONS = {
  fleet: FleetIcon,
  trace: TraceIcon,
  costs: CostsIcon,
  sso: SSOIcon,
  settings: SettingsIcon,
} as const;

export const NAV_ITEMS = [
  { id: "fleet" as const, label: "Fleet", icon: "◇", href: "/" },
  { id: "trace" as const, label: "Trace", icon: "◎", href: "/trace" },
  { id: "costs" as const, label: "Costs", icon: "⟐", href: "/cost" },
  { id: "sso" as const, label: "SSO", icon: "◈", href: "/sso" },
  { id: "settings" as const, label: "Settings", icon: "✦", href: "/settings" },
];
