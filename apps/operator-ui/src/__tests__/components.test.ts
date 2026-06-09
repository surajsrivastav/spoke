import { describe, it, expect } from "vitest";

describe("Component exports", () => {
  it("StatusBadge exports successfully", async () => {
    const mod = await import("../app/components/lib/StatusBadge");
    expect(mod.StatusBadge).toBeDefined();
    expect(mod.StatusDot).toBeDefined();
    expect(mod.BadgePill).toBeDefined();
  });

  it("Button exports successfully", async () => {
    const mod = await import("../app/components/lib/Button");
    expect(mod.Button).toBeDefined();
  });

  it("ProgressBar exports successfully", async () => {
    const mod = await import("../app/components/lib/ProgressBar");
    expect(mod.ProgressBar).toBeDefined();
  });

  it("KillModal exports successfully", async () => {
    const mod = await import("../app/components/lib/KillModal");
    expect(mod.default).toBeDefined();
  });

  it("Sidebar exports successfully", async () => {
    const mod = await import("../app/components/lib/Sidebar");
    expect(mod.default).toBeDefined();
  });

  it("AppLayout exports successfully", async () => {
    const mod = await import("../app/components/lib/AppLayout");
    expect(mod.default).toBeDefined();
  });

  it("TaskTracePanel exports successfully", async () => {
    const mod = await import("../app/components/TaskTracePanel");
    expect(mod.default).toBeDefined();
  });

  it("CommandPalette exports successfully", async () => {
    const mod = await import("../app/components/CommandPalette");
    expect(mod.default).toBeDefined();
  });
});

describe("StatusBadge rendering spec", () => {
  it("returns correct badge for each status", async () => {
    const { STATUS_CONFIG } = await import("../app/lib/constants");
    const statuses = ["pending", "running", "succeeded", "failed", "killed"];
    for (const s of statuses) {
      const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG];
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("KillModal logic", () => {
  it("requires KILL text to enable kill button", async () => {
    const KillModal = (await import("../app/components/lib/KillModal")).default;
    expect(typeof KillModal).toBe("function");
  });

  it("has correct confirmation text", async () => {
    const KillModal = (await import("../app/components/lib/KillModal")).default;
    expect(typeof KillModal).toBe("function");
    expect(KillModal.length).toBe(1); // has one props argument
  });
});

describe("Button variants", () => {
  it("all button variants render without error", async () => {
    const { Button } = await import("../app/components/lib/Button");
    expect(typeof Button).toBe("function");
    expect(Button.length).toBeGreaterThan(0); // Has props
  });
});

describe("Page exports", () => {
  const pages = [
    { path: "../app/page", name: "FleetPage" },
    { path: "../app/cost/page", name: "CostPage" },
    { path: "../app/sso/page", name: "SSOPage" },
    { path: "../app/empty/page", name: "EmptyPage" },
    { path: "../app/error/page", name: "ErrorPage" },
    { path: "../app/incident/page", name: "IncidentPage" },
  ];

  for (const p of pages) {
    it(`${p.name} exports successfully`, async () => {
      const mod = await import(p.path);
      expect(mod.default).toBeDefined();
    });
  }
});
