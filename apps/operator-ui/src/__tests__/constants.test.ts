import { describe, it, expect } from "vitest";
import { STATUS_CONFIG, EVENT_TYPE_CONFIG, NAV_ITEMS } from "../app/lib/constants";

describe("STATUS_CONFIG", () => {
  const statuses = ["pending", "running", "succeeded", "failed", "killed"];

  it("defines config for all task statuses", () => {
    for (const s of statuses) {
      expect(STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]).toBeDefined();
      const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG];
      expect(cfg.color).toBeTruthy();
      expect(cfg.label).toBeTruthy();
      expect(cfg.bg).toContain("rgba");
      expect(cfg.border).toContain("rgba");
    }
  });

  it("has correct labels", () => {
    expect(STATUS_CONFIG.pending.label).toBe("Pending");
    expect(STATUS_CONFIG.running.label).toBe("Running");
    expect(STATUS_CONFIG.succeeded.label).toBe("Completed");
    expect(STATUS_CONFIG.failed.label).toBe("Failed");
    expect(STATUS_CONFIG.killed.label).toBe("Killed");
  });

  it("has consistent colors per status grouping", () => {
    const colors = statuses.map((s) => STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].color);
    // killed and pending share gray; failed is distinct
    expect(colors.filter((c) => c === "#6b7280").length).toBe(2);
    expect(colors.filter((c) => c === "#ef4444").length).toBe(1);
  });
});

describe("EVENT_TYPE_CONFIG", () => {
  const events = [
    "TASK_STARTED", "SANDBOX_CREATED", "REPO_CLONED", "MODEL_CALLED",
    "PLAN_CREATED", "TOOL_CALLED", "VERIFICATION_RAN", "GIT_COMMITTED",
    "PR_CREATED", "TASK_KILLED",
  ];

  it("defines config for all event types", () => {
    for (const e of events) {
      expect(EVENT_TYPE_CONFIG[e]).toBeDefined();
      expect(EVENT_TYPE_CONFIG[e].color).toBeTruthy();
      expect(EVENT_TYPE_CONFIG[e].icon).toBeTruthy();
    }
  });

  it("has valid hex colors", () => {
    for (const e of events) {
      expect(EVENT_TYPE_CONFIG[e].color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("NAV_ITEMS", () => {
  it("has all required navigation items", () => {
    const ids = NAV_ITEMS.map((n) => n.id);
    expect(ids).toContain("fleet");
    expect(ids).toContain("costs");
    expect(ids).toContain("sso");
    expect(ids).toContain("settings");
  });

  it("each item has required fields", () => {
    for (const item of NAV_ITEMS) {
      expect(item.label).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.href).toBeTruthy();
    }
  });
});
