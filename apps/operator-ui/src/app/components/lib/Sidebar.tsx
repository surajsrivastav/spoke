"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "../../lib/constants";

export default function Sidebar() {
  const pathname = usePathname();

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
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, color: "#fff", fontWeight: 800, fontFamily: "Geist Mono, monospace" }}>
            ◈
          </span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: "#fff",
              fontFamily: "Geist Mono, monospace",
              letterSpacing: "-0.02em",
            }}
          >
            HARNESS
          </span>
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginTop: 4,
            marginLeft: 26,
          }}
        >
          Agent Control Plane
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: "8px 8px", flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
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
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Bottom Status */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--status-running)" }}>
            ● 3 running
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            ● 12 done
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--status-failed)" }}>
            ● 1 failed
          </span>
        </div>
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            fontFamily: "Geist Mono, monospace",
          }}
        >
          $106.20 today
        </div>
      </div>

      {/* User area */}
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
