"use client";

import type { TaskStatus } from "@spoke/shared";
import { STATUS_CONFIG } from "../../lib/constants";

// Run-level statuses (e.g. "provisioning") are not in STATUS_CONFIG;
// render them with a neutral badge instead of crashing.
function statusConfig(status: string) {
  return (
    STATUS_CONFIG[status as TaskStatus] ?? {
      color: "#6b7280",
      label: status.charAt(0).toUpperCase() + status.slice(1),
      bg: "rgba(107,114,128,0.12)",
      border: "rgba(107,114,128,0.2)",
    }
  );
}

export function StatusBadge({ status }: { status: TaskStatus | string }) {
  const cfg = statusConfig(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs-c-w6"
      style={{
        width: 90,
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        justifyContent: "center",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}

export function StatusDot({
  status,
  pulsing,
}: {
  status: TaskStatus | string;
  pulsing?: boolean;
}) {
  const cfg = statusConfig(status);
  return (
    <span className="relative flex h-2 w-2 items-center justify-center">
      {pulsing && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
          style={{ backgroundColor: cfg.color, animationDuration: "1.5s" }}
        />
      )}
      <span
        className="relative h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
    </span>
  );
}

export function BadgePill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs-c-w6"
      style={{
        backgroundColor: `${color}1e`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
