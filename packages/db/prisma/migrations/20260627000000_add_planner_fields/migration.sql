-- AlterTable: add planner fields to tasks
ALTER TABLE "tasks" ADD COLUMN "max_agents" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "tasks" ADD COLUMN "risk_level" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "tasks" ADD COLUMN "strategy" TEXT NOT NULL DEFAULT 'single-agent';
