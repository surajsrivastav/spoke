"use client";

type Variant = "primary" | "danger" | "secondary" | "ghost";

const variantClass: Record<Variant, string> = {
  primary: "bg-[var(--accent-primary)] text-white hover:brightness-110",
  danger: "bg-[var(--status-failed)] text-white hover:brightness-90",
  secondary: "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)]",
  ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]",
};

const sizeClass: Record<string, string> = {
  sm: "px-[10px] py-[4px] text-[11px]",
  md: "px-[14px] py-[7px] text-[--text-ui]",
  lg: "px-[20px] py-[10px] text-[14px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  disabled,
  children,
  onClick,
  className = "",
  style,
}: {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {children}
    </button>
  );
}
