"use client";

interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className = "" }: ProgressBarProps) {
  return (
    <div
      className={`h-0.5 w-full ${className}`}
      style={{ background: "var(--bg-elevated)", borderRadius: 0 }}
    >
      <div
        className="h-full transition-all"
        style={{
          width: `${Math.min(value, 100)}%`,
          background: "var(--accent-primary)",
          transition: "width 600ms linear",
        }}
      />
    </div>
  );
}
