"use client";

import { useState } from "react";
import { BadgePill } from "../components/lib/StatusBadge";

type Tab = "providers" | "rbac" | "audit";

const AUDIT_EVENTS = [
  { time: "2m ago", user: "alice@ford.com", action: "LOGIN_SUCCESS", provider: "google", ip: "192.168.1.42" },
  { time: "8m ago", user: "bob@ford.com", action: "LOGIN_SUCCESS", provider: "google", ip: "10.0.0.15" },
  { time: "1h ago", user: "unknown@gmail.com", action: "LOGIN_DENIED", provider: "google", ip: "203.0.113.42" },
  { time: "2h ago", user: "alice@ford.com", action: "ROLE_CHANGED", provider: "internal", ip: "192.168.1.42" },
  { time: "3h ago", user: "charlie@ford.com", action: "LOGIN_SUCCESS", provider: "google", ip: "10.0.0.20" },
  { time: "5h ago", user: "unknown@outlook.com", action: "LOGIN_DENIED", provider: "google", ip: "198.51.100.1" },
];

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: "var(--status-completed)",
  LOGIN_DENIED: "var(--status-failed)",
  ROLE_CHANGED: "var(--status-warning)",
};

export default function SSOPage() {
  const [tab, setTab] = useState<Tab>("providers");

  return (
    <div>
      {/* Context banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "rgba(99,102,241,0.08)",
          borderBottom: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 8,
          marginBottom: 20,
          fontSize: "var(--text-xs)",
          color: "var(--accent-primary)",
        }}
      >
        <span>✦</span>
        <span>SSO is available as an optional configuration for self-hosted deployments and is not required for the core open-source product.</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)", marginBottom: 20 }}>
        {(["providers", "rbac", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--text-ui)",
              fontWeight: 500,
              color: tab === t ? "var(--accent-primary)" : "var(--text-tertiary)",
              borderBottom: tab === t ? "2px solid var(--accent-primary)" : "2px solid transparent",
              textTransform: "capitalize",
              transition: "color 100ms ease",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "providers" && <ProvidersTab />}
      {tab === "rbac" && <RBACTab />}
      {tab === "audit" && <AuditLogTab />}
    </div>
  );
}

function ProvidersTab() {
  return (
    <div>
      {/* Google Active */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "var(--sp-4) var(--sp-5)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 8,
          background: "var(--bg-surface)",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          G
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 500, color: "var(--text-primary)" }}>Google Workspace</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Example preview — not connected</div>
        </div>
        <BadgePill label="Preview" color="#6b7280" />
        <button
          disabled
          title="Optional self-hosted setup"
          style={{
            background: "none",
            border: "1px solid var(--border-subtle)",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: "var(--text-ui)",
            fontWeight: 500,
            color: "var(--text-tertiary)",
            cursor: "not-allowed",
          }}
        >
          Configure →
        </button>
      </div>

      {/* Okta inactive */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "var(--sp-4) var(--sp-5)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          background: "var(--bg-surface)",
          marginBottom: 8,
          opacity: 0.7,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          O
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 500, color: "var(--text-primary)" }}>Okta</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Not configured</div>
        </div>
        <button
          disabled
          title="Optional self-hosted setup"
          style={{
            background: "none",
            border: "1px solid var(--border-subtle)",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: "var(--text-ui)",
            fontWeight: 500,
            color: "var(--text-tertiary)",
            cursor: "not-allowed",
          }}
        >
          Set up →
        </button>
      </div>

      {/* JIT toggle */}
      <div
        style={{
          marginTop: 24,
          padding: "var(--sp-4) var(--sp-5)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 500, color: "var(--text-primary)" }}>Auto-create accounts on first SSO login</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 2 }}>
              Default role: <strong>operator</strong>
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              background: "var(--accent-primary)",
              position: "relative",
              cursor: "pointer",
              transition: "background 100ms ease",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                position: "absolute",
                top: 2,
                right: 2,
                transition: "right 100ms ease",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RBACTab() {
  const roles = [
    {
      name: "Admin",
      color: "#f59e0b",
      members: 3,
      permissions: ["Kill any task", "Configure SSO", "Manage RBAC", "View all traces", "Manage budgets"],
      users: ["AL", "BS", "CM"],
    },
    {
      name: "Operator",
      color: "#6366f1",
      members: 12,
      permissions: ["View all tasks", "Kill own tasks", "View traces", "View costs"],
      users: ["AS", "BD", "CF", "DK"],
    },
    {
      name: "Viewer",
      color: "#94a3b8",
      members: 8,
      permissions: ["View tasks", "View traces"],
      users: ["ER", "FG", "GH"],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {roles.map((role) => (
        <div
          key={role.name}
          style={{
            padding: "var(--sp-5) var(--sp-5)",
            background: "var(--bg-surface)",
            border: `1px solid var(--border-subtle)`,
            borderLeft: `3px solid ${role.color}`,
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "var(--text-h3)", fontWeight: 600, color: "var(--text-primary)" }}>{role.name}</span>
              <BadgePill label={`${role.members} members`} color={role.color} />
            </div>
            <button
              style={{
                background: "none",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Edit →
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {role.permissions.map((p) => (
              <span
                key={p}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  color: role.color,
                  background: `${role.color}15`,
                  border: `1px solid ${role.color}25`,
                }}
              >
                ✓ {p}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {role.users.map((u, i) => (
              <div
                key={i}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: role.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#fff",
                }}
                title={u}
              >
                {u}
              </div>
            ))}
            {role.members > role.users.length && (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: "var(--text-tertiary)",
                }}
              >
                +{role.members - role.users.length}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditLogTab() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          style={{
            background: "none",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: "var(--text-ui)",
            fontWeight: 500,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          ↓ Export CSV
        </button>
      </div>

      <div
        style={{
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "var(--sp-2) var(--sp-4)",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "var(--text-xs)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
          }}
        >
          <div style={{ width: 70 }}>Time</div>
          <div style={{ flex: 1 }}>User</div>
          <div style={{ width: 130 }}>Action</div>
          <div style={{ width: 80 }}>Provider</div>
          <div style={{ width: 120 }}>IP</div>
        </div>

        {AUDIT_EVENTS.map((ev, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "var(--sp-2) var(--sp-4)",
              borderBottom: i < AUDIT_EVENTS.length - 1 ? "1px solid var(--border-subtle)" : "none",
              fontSize: "var(--text-sm)",
              fontFamily: "Geist Mono, monospace",
              background: i % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent",
            }}
          >
            <div style={{ width: 70, color: "var(--text-tertiary)" }}>{ev.time}</div>
            <div style={{ flex: 1, color: "var(--text-primary)" }}>{ev.user}</div>
            <div style={{ width: 130, color: ACTION_COLORS[ev.action] || "var(--text-secondary)" }}>
              {ev.action}
            </div>
            <div style={{ width: 80, color: "var(--text-tertiary)" }}>{ev.provider}</div>
            <div style={{ width: 120, color: "var(--text-tertiary)" }}>{ev.ip}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
