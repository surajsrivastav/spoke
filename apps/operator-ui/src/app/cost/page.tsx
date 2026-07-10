"use client";

import { useEffect, useMemo, useState } from "react";

const RANGES = ["7d", "30d", "90d"] as const;
type Range = (typeof RANGES)[number];

const MODEL_COLORS = ["#fbbf24", "#818cf8", "#2dd4bf", "#60a5fa", "#a78bfa", "#fb923c"];

interface CostData {
  month_spend: number;
  monthly_budget: number;
  daily: { day: string; cost: number }[];
  by_model: { model: string; cost: number }[];
  top_tasks: { id: string; goal: string; cost: number; cap: number; actor: string; status: string; created_at: string }[];
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CostPage() {
  const [range, setRange] = useState<Range>("30d");
  const [showBudgetAlert, setShowBudgetAlert] = useState(true);
  const [data, setData] = useState<CostData | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/costs?range=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d) setData(d); })
      .catch(() => {});
    return () => { active = false; };
  }, [range]);

  const budgetUsed = data?.month_spend ?? 0;
  const budgetTotal = data?.monthly_budget || 500;
  const pct = Math.min((budgetUsed / budgetTotal) * 100, 100);
  const barColor = pct > 80 ? "var(--status-failed)" : pct > 50 ? "var(--status-warning)" : "var(--accent-primary)";

  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.max(endOfMonth.getDate() - now.getDate(), 0);
  const dayOfMonth = now.getDate();
  const projectedEndCost = dayOfMonth > 0 ? (budgetUsed / dayOfMonth) * endOfMonth.getDate() : budgetUsed;
  const isOverBudget = projectedEndCost > budgetTotal;

  const dailyCosts = useMemo(() => {
    const raw = data?.daily ?? [];
    return raw.slice(-14).map((d) => ({
      day: new Date(`${d.day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      cost: d.cost,
    }));
  }, [data]);

  const maxDaily = Math.max(...dailyCosts.map((d) => d.cost), 0.01);

  const byModel = useMemo(() => {
    const raw = data?.by_model ?? [];
    const total = raw.reduce((s, m) => s + m.cost, 0) || 1;
    return raw.slice(0, 6).map((m, i) => ({
      model: m.model,
      cost: m.cost,
      pct: Math.round((m.cost / total) * 100),
      color: MODEL_COLORS[i % MODEL_COLORS.length],
    }));
  }, [data]);

  const byActor = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of data?.top_tasks ?? []) {
      totals.set(t.actor, (totals.get(t.actor) ?? 0) + t.cost);
    }
    const entries = [...totals.entries()].sort(([, a], [, b]) => b - a).slice(0, 6);
    const total = entries.reduce((s, [, c]) => s + c, 0) || 1;
    return entries.map(([actor, cost], i) => ({
      type: actor,
      cost,
      pct: Math.round((cost / total) * 100),
      color: MODEL_COLORS[(i + 3) % MODEL_COLORS.length],
    }));
  }, [data]);

  const tasks = useMemo(
    () =>
      (data?.top_tasks ?? []).map((t) => ({
        id: t.id.length > 12 ? `${t.id.slice(0, 8)}…` : t.id,
        goal: t.goal,
        cost: t.cost,
        actor: t.actor,
        time: timeAgo(t.created_at),
      })),
    [data],
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: "var(--text-h2)", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
          Cost Intelligence
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-surface)", borderRadius: 6, border: "1px solid var(--border-subtle)", padding: 2 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                background: range === r ? "var(--accent-primary)" : "transparent",
                color: range === r ? "#fff" : "var(--text-tertiary)",
                border: "none",
                borderRadius: 4,
                padding: "3px 10px",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "Geist Mono, monospace",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Budget Alert */}
      {showBudgetAlert && isOverBudget && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", color: "var(--status-failed)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3" />
              <path d="M8 11h.01" />
            </svg>
            <span>Projected to exceed monthly budget by 15% at current burn rate</span>
          </div>
          <button
            onClick={() => setShowBudgetAlert(false)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: 14,
              padding: 2,
            }}
          >
            {"\u2715"}
          </button>
        </div>
      )}

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
              All Teams — {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
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

        {/* Projection */}
        <div style={{ marginTop: 8, fontSize: "var(--text-xs)", color: isOverBudget ? "var(--status-failed)" : "var(--status-completed)", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {isOverBudget ? <path d="M8 12V4" /> : <path d="M8 4v8" />}
            {isOverBudget ? <path d="M11 9L8 12 5 9" /> : <path d="M11 7L8 4 5 7" />}
          </svg>
          Projected end-of-period: ${projectedEndCost.toFixed(2)}
          {isOverBudget && ` (${(projectedEndCost - budgetTotal).toFixed(2)} over budget)`}
        </div>
      </div>

      {/* Daily cost sparkline */}
      <div
        style={{
          padding: "var(--sp-4) var(--sp-5)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: "var(--text-sub)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 12 }}>
          Daily Spend
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
          {dailyCosts.map((d) => (
            <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: "100%",
                  height: `${(d.cost / maxDaily) * 48}px`,
                  minHeight: 4,
                  background: d.cost > 20 ? "var(--status-failed)" : "var(--accent-primary)",
                  borderRadius: "3px 3px 0 0",
                  transition: "height 300ms ease",
                  opacity: 0.8,
                }}
                title={`${d.day}: $${d.cost.toFixed(2)}`}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                {d.day.slice(d.day.indexOf(" ") + 1)}
              </span>
            </div>
          ))}
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

        {/* By Actor */}
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
            By Actor
          </div>
          {byActor.map((item) => (
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
            <div style={{ width: 60, textAlign: "right" }}>Actor</div>
            <div style={{ width: 70, textAlign: "right" }}>Cost</div>
            <div style={{ width: 70, textAlign: "right" }}>Time</div>
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
                  background: i % 2 === 1 ? "var(--bg-elevated)" : "transparent",
                  fontSize: "var(--text-sm)",
                }}
              >
                <div style={{ width: 100, fontFamily: "Geist Mono, monospace", color: "var(--text-tertiary)" }}>
                  {t.id}
                </div>
                <div style={{ flex: 1, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.goal}
                </div>
                <div style={{ width: 60, textAlign: "right", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  {t.actor}
                </div>
                <div
                  style={{
                    width: 70,
                    textAlign: "right",
                    fontFamily: "Geist Mono, monospace",
                    color: costColor,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ${t.cost.toFixed(2)}
                </div>
                <div style={{ width: 70, textAlign: "right", fontFamily: "Geist Mono, monospace", color: "var(--text-tertiary)" }}>
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
