"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Task, TaskRun } from "@spoke/shared";
import { generateTaskName } from "@spoke/shared";
import { STATUS_CONFIG } from "./lib/constants";
import { StatusBadge, StatusDot } from "./components/lib/StatusBadge";
import { ProgressBar } from "./components/lib/ProgressBar";
import KillModal from "./components/lib/KillModal";
import TaskTracePanel from "./components/TaskTracePanel";

type Tab = "all" | "running" | "completed" | "failed";

const TEMPLATES = [
  { label: "Custom task", goal: "", repo: "" },
  { label: "Add UI feature", goal: "Add a dark mode toggle to the UI", repo: "https://github.com/org/spoke" },
  { label: "Write tests", goal: "Write unit tests for the API layer", repo: "https://github.com/org/spoke" },
  { label: "Fix bugs", goal: "Fix rate limiting middleware bug", repo: "https://github.com/org/spoke" },
  { label: "Create app", goal: "Create a CLI calculator application", repo: "https://github.com/org/spoke" },
];

const ESTIMATE_PER_TOKEN = 0.000015;

function estimateCost(goal: string): number {
  const words = goal.split(/\s+/).length;
  const tokens = words * 1.3;
  const modelCalls = Math.max(1, Math.ceil(words / 50));
  return +(tokens * ESTIMATE_PER_TOKEN * modelCalls * 3).toFixed(2);
}

function DeltaArrow({ value }: { value: string }) {
  const isUp = value.startsWith("↑");
  const isDown = value.startsWith("↓");
  const color = isUp ? "var(--arrow-up)" : isDo

... [truncated 31708 bytes] ...

-secondary)",
                  cursor: "pointer",
                  padding: "7px 14px",
                  fontSize: "var(--text-ui)",
                  fontWeight: 500,
                  borderRadius: 6,
                  opacity: creating ? 0.4 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={creating || !createGoal.trim() || !createRepo.trim()}
                style={{
                  background: !createGoal.trim() || !createRepo.trim() ? "var(--bg-elevated)" : "var(--accent-primary)",
                  color: !createGoal.trim() || !createRepo.trim() ? "var(--text-tertiary)" : "#fff",
                  border: "none",
                  cursor: !createGoal.trim() || !createRepo.trim() ? "not-allowed" : "pointer",
                  padding: "7px 14px",
                  fontSize: "var(--text-ui)",
                  fontWeight: 500,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {creating ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kill Modal */}
      {killTarget && (
        <KillModal
          task={killTarget}
          onClose={() => setKillTarget(null)}
          onKill={handleKill}
        />
      )}
    </div>
  );
}