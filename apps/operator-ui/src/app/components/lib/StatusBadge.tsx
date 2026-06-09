"use client";

import type { TaskStatus } from "@spoke/shared";
import { STATUS_CONFIG } from "../../lib/constants";

export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
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
  status: TaskStatus;
  pulsing?: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
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
