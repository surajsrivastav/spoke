"use client";

export default function CostPage() {
  const budgetUsed = 106.2;
  const budgetTotal = 500;
  const pct = (budgetUsed / budgetTotal) * 100;
  const barColor = pct > 80 ? "var(--status-failed)" : pct > 50 ? "var(--status-warning)" : "var(--accent-primary)";
  const daysLeft = 9;

  const byModel = [
    { model: "claude-sonnet-4", cost: 71.3, pct: 67, color: "#fbbf24" },
    { model: "claude-haiku-4", cost: 25.4, pct: 24, color: "#818cf8" },
    { model: "custom-agent", cost: 9.5, pct: 9, color: "#2dd4bf" },
  ];

  const byType = [
    { type: "Code generation", cost: 48.2, pct: 45, color: "#60a5fa" },
    { type: "Testing", cost: 31.8, pct: 30, color: "#a78bfa" },
    { type: "Review", cost: 16.1, pct: 15, color: "#4ade80" },
    { type: "Debugging", cost: 10.1, pct: 10, color: "#fb923c" },
  ];

  const tasks = [
    { id: "task_01ABC", goal: "Add JWT auth to Express API", cost: 4.82, actor: "alice", time: "2m ago" },
    { id: "task_02DEF", goal: "Refactor user service", cost: 3.21, actor: "bob", time: "8m ago" },
    { id: "task_03GHI", goal: "Fix rate limiting middleware", cost: 1.95, actor: "alice", time: "15m ago" },
    { id: "task_04JKL", goal: "Add input validation", cost: 2.44, actor: "charlie", time: "32m ago" },
    { id: "task_05MNO", goal: "Write integration tests for auth", cost: 1.12, actor: "bob", time: "1h ago" },
  ];

  return (
    <div>
      {/* Page title */}
      <div style={{ fontSize: "var(--text-h2)", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: 20 }}>
        Cost Intelligence
      </div>

      {/* Budget Meter */}
      <div
        style={{
          padding: "var(--sp-5) var(--sp-6)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 2 }}>
              Platform Team — June 2026
            </div>
            <div style={{ fontSize: "var(--text-h3)", fontWeight: 600, color: "var(--text-primary)" }}>
              ${budgetUsed.toFixed(2)} used of ${budgetTotal.toFixed(0)} budget
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: barColor, fontVariantNumeric: "tabular-nums" }}>
              {pct.toFixed(1)}%
            </div>
          </div>
        </div>

        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: "var(--bg-elevated)",
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
              transition: "width 400ms ease-out",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          <span>${(budgetTotal - budgetUsed).toFixed(2)} remaining</span>
          <span>{daysLeft} days left in period</span>
        </div>
      </div>

      {/* Two-column charts */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {/* By Model */}
        <div
          style={{
            flex: 1,
            padding: "var(--sp-5) var(--sp-5)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: "var(--text-sub)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 16 }}>
            By Model
          </div>
          {byModel.map((item) => (
            <div key={item.model} style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 140, fontSize: "var(--text-sm)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.model}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 4, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, width: `${item.pct}%`, background: item.color }} />
                </div>
              </div>
              <div style={{ width: 60, textAlign: "right", fontFamily: "Geist Mono, monospace", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                ${item.cost.toFixed(2)}
              </div>
              <div style={{ width: 36, textAlign: "right", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                {item.pct}%
              </div>
            </div>
          ))}
        </div>

        {/* By Task Type */}
        <div
          style={{
            flex: 1,
            padding: "var(--sp-5) var(--sp-5)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: "var(--text-sub)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 16 }}>
            By Task Type
          </div>
          {byType.map((item) => (
            <div key={item.type} style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 140, fontSize: "var(--text-sm)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.type}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 4, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, width: `${item.pct}%`, background: item.color }} />
                </div>
              </div>
              <div style={{ width: 60, textAlign: "right", fontFamily: "Geist Mono, monospace", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                ${item.cost.toFixed(2)}
              </div>
              <div style={{ width: 36, textAlign: "right", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                {item.pct}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost table */}
      <div>
        <div style={{ fontSize: "var(--text-sub)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 12 }}>
          Task Costs
        </div>
        <div
          style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "var(--sp-2) var(--sp-4)",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: "var(--text-xs)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
            }}
          >
            <div style={{ width: 100 }}>Task ▲</div>
            <div style={{ flex: 1 }}>Goal</div>
            <div style={{ width: 80, textAlign: "right" }}>Cost</div>
            <div style={{ width: 80, textAlign: "right" }}>Time</div>
          </div>

          {tasks.map((t, i) => {
            const costColor = t.cost > 4 ? "var(--status-failed)" : t.cost > 2 ? "var(--status-warning)" : "var(--text-secondary)";
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "var(--sp-3) var(--sp-4)",
                  borderBottom: i < tasks.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  background: i % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent",
                  fontSize: "var(--text-sm)",
                }}
              >
                <div style={{ width: 100, fontFamily: "Geist Mono, monospace", color: "var(--text-tertiary)" }}>
                  {t.id}
                </div>
                <div style={{ flex: 1, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.goal}
                </div>
                <div
                  style={{
                    width: 80,
                    textAlign: "right",
                    fontFamily: "Geist Mono, monospace",
                    color: costColor,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ${t.cost.toFixed(2)}
                </div>
                <div style={{ width: 80, textAlign: "right", fontFamily: "Geist Mono, monospace", color: "var(--text-tertiary)" }}>
                  {t.time}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
