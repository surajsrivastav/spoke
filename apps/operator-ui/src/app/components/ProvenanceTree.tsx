"use client";

import { useState } from "react";
import type { Provenance } from "@spoke/shared";

export default function ProvenanceTree({
  provenances,
}: {
  provenances: Provenance[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (provenances.length === 0) {
    return <p className="text-xs text-gray-400">No provenance events.</p>;
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="text-xs font-medium text-gray-500 hover:text-gray-700"
      >
        {collapsed ? "▶" : "▼"} Provenance ({provenances.length})
      </button>

      {!collapsed && (
        <div className="ml-3 border-l-2 border-gray-200 pl-3">
          {provenances.map((p) => (
            <div key={p.id} className="py-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
                  {p.type}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
                <span>${Number(p.cost_usd).toFixed(4)}</span>
                <span>{p.tokens} tokens</span>
                {p.duration_ms != null && <span>{p.duration_ms}ms</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
