"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_ITEM_ICONS } from "../../lib/constants";
import { useTheme } from "./ThemeContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v8" />
            <path d="M6 10h8" />
          </svg>
          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: "#fff",
              fontFamily: "Geist Mono, monospace",
              letterSpacing: "-0.02em",
            }}
          >
            SPOKE
          </span>
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginTop: 4,
            marginLeft: 28,
          }}
        >
          Agent Control Plane
        </div>
      </div>

      <nav style={{ padding: "8px 8px", flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const IconComponent = NAV_ITEM_ICONS[item.id];
          return (
            <a
              key={item.id}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: "var(--text-ui)",
                fontWeight: 500,
                color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-glow)" : "transparent",
                borderLeft: isActive ? "2px solid var(--accent-primary)" : "2px solid transparent",
                textDecoration: "none",
                marginBottom: 2,
                transition: "all 100ms ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--bg-overlay)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 0 }}>
                <IconComponent />
              </span>
              {item.label}
            </a>
          );
        })}
      </nav>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 6,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
          }}
        >
          {theme === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 8.5A6 6 0 0 1 7.5 2 6 6 0 1 0 14 8.5z" />
            </svg>
          )}
          {theme === "dark" ? "Light" : "Dark"}
        </button>

        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            fontFamily: "Geist Mono, monospace",
          }}
        >
          $106.20
        </div>
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--accent-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          AS
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.2 }}>
            alice@ford.com
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Operator
          </div>
        </div>
      </div>
    </aside>
  );
}
