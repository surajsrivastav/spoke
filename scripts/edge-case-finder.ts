#!/usr/bin/env tsx
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLocal = resolve(__dirname, '../.env.local');
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, 'utf-8').split('\n')) {
    const m = line.match(/^(\w+)=(.+)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/@postgres:/, '@localhost:');
    }
  }
}

import { prisma } from '@spoke/db';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let exitCode = 0;

function warn(label: string, msg: string) {
  console.log(`  ${YELLOW}⚠ ${label}${RESET} ${msg}`);
}

function fail(label: string, msg: string) {
  console.log(`  ${RED}✖ ${label}${RESET} ${msg}`);
  exitCode = 1;
}

function ok(label: string, msg?: string) {
  console.log(`  ${CYAN}✓ ${label}${RESET}${msg ? ` ${DIM}${msg}${RESET}` : ''}`);
}

async function checkStuckRunningTasks() {
  const stuck = await prisma.task.findMany({
    where: {
      status: 'running',
      updated_at: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { updated_at: 'asc' },
  });
  if (stuck.length === 0) { ok('Stuck running tasks'); return; }
  fail('Stuck running tasks', `${stuck.length} task(s) in 'running' >1hr`);
  for (const t of stuck) {
    warn(`  task ${t.id.slice(0, 8)}`, `goal="${t.goal.slice(0, 60)}" updated ${Math.round((Date.now() - t.updated_at.getTime()) / 60000)}m ago`);
  }
}

async function checkPendingOverdue() {
  const stale = await prisma.task.findMany({
    where: {
      status: 'pending',
      created_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { created_at: 'asc' },
  });
  if (stale.length === 0) { ok('Pending tasks'); return; }
  fail('Stale pending tasks', `${stale.length} task(s) pending >24hr`);
  for (const t of stale) {
    warn(`  task ${t.id.slice(0, 8)}`, `created ${Math.round((Date.now() - t.created_at.getTime()) / 3600000)}h ago goal="${t.goal.slice(0, 60)}"`);
  }
}

async function checkZombieSandboxes() {
  const zombies = await prisma.taskRun.findMany({
    where: {
      status: { in: ['provisioning', 'executing', 'verifying', 'pushing'] },
      sandbox_id: { not: null },
      started_at: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    },
    orderBy: { started_at: 'asc' },
  });
  if (zombies.length === 0) { ok('Sandbox duration'); return; }
  fail('Zombie sandboxes', `${zombies.length} task run(s) with sandbox running >2hr`);
  for (const r of zombies) {
    warn(`  run ${r.id.slice(0, 8)}`, `sandbox=${r.sandbox_id?.slice(0, 12)} status=${r.status} started ${Math.round((Date.now() - r.started_at.getTime()) / 60000)}m ago`);
  }
}

async function checkExcessiveRetries() {
  const runs = await prisma.taskRun.groupBy({
    by: ['task_id'],
    _max: { attempt: true },
    having: { attempt: { _max: { gte: 3 } } },
  });
  if (runs.length === 0) { ok('Task retry attempts'); return; }
  warn('Excessive retries', `${runs.length} task(s) with >=3 attempts`);
  for (const r of runs.slice(0, 5)) {
    const task = await prisma.task.findUnique({ where: { id: r.task_id } });
    warn(`  task ${r.task_id.slice(0, 8)}`, `max_attempt=${r._max.attempt} goal="${task?.goal.slice(0, 60) ?? '?'}"`);
  }
  if (runs.length > 5) warn('  ...', `${runs.length - 5} more`);
}

async function checkCostAnomalies() {
  const tasks = await prisma.task.findMany({
    where: { status: { in: ['running', 'succeeded', 'failed'] } },
    select: {
      id: true, goal: true, cost_cap_usd: true, status: true,
      task_runs: { select: { total_cost_usd: true, total_tokens: true } },
    },
  });
  const nearCap = tasks.filter(t => {
    const total = t.task_runs.reduce((s, r) => s + Number(r.total_cost_usd), 0);
    return Number(t.cost_cap_usd) > 0 && total / Number(t.cost_cap_usd) > 0.8;
  });
  if (nearCap.length === 0) { ok('Cost cap utilization'); return; }
  warn('Cost anomalies', `${nearCap.length} task(s) at >80% cost cap`);
  for (const t of nearCap.slice(0, 5)) {
    const total = t.task_runs.reduce((s, r) => s + Number(r.total_cost_usd), 0);
    warn(`  task ${t.id.slice(0, 8)}`, `$${total.toFixed(2)} / $${Number(t.cost_cap_usd).toFixed(2)} cap goal="${t.goal.slice(0, 40)}"`);
  }
}

async function checkUnusualGoals() {
  const all = await prisma.task.findMany({ select: { id: true, goal: true } });
  const short = all.filter(t => t.goal.trim().length < 5);
  const long = all.filter(t => t.goal.length > 500);
  const suspicious = all.filter(t => /[<>{}\]|\\^~`]/.test(t.goal) && !t.goal.includes('```'));
  if (short.length === 0 && long.length === 0 && suspicious.length === 0) { ok('Goal content'); return; }
  if (short.length) warn('Short goals', `${short.length} task(s) with goal <5 chars`);
  if (long.length) warn('Long goals', `${long.length} task(s) with goal >500 chars`);
  if (suspicious.length) warn('Suspicious goals', `${suspicious.length} task(s) with shell metacharacters`);
  for (const t of [...short.slice(0, 3), ...long.slice(0, 3), ...suspicious.slice(0, 3)]) {
    warn(`  task ${t.id.slice(0, 8)}`, `goal="${t.goal.slice(0, 80)}"`);
  }
}

async function checkFailedTaskRuns() {
  const failed = await prisma.taskRun.findMany({
    where: { status: 'failed' },
    orderBy: { started_at: 'desc' },
    take: 20,
  });
  if (failed.length === 0) { ok('Recent failures'); return; }
  warn('Recent failed runs', `${failed.length} failed task run(s) in last 20`);
  for (const r of failed.slice(0, 5)) {
    warn(`  run ${r.id.slice(0, 8)}`, `attempt=${r.attempt} task=${r.task_id.slice(0, 8)}`);
  }
}

async function checkProvenanceGaps() {
  const runs = await prisma.taskRun.findMany({
    where: { status: { not: 'provisioning' } },
    include: { _count: { select: { provenances: true } } },
    orderBy: { started_at: 'desc' },
    take: 50,
  });
  const gaps = runs.filter(r => r._count.provenances === 0 && r.status !== 'failed');
  if (gaps.length === 0) { ok('Provenance coverage'); return; }
  warn('Provenance gaps', `${gaps.length} non-failed run(s) with no provenance`);
  for (const r of gaps.slice(0, 3)) {
    warn(`  run ${r.id.slice(0, 8)}`, `status=${r.status} task=${r.task_id.slice(0, 8)}`);
  }
}

async function checkRapidFailures() {
  const recent = await prisma.task.findMany({
    where: { status: 'failed' },
    orderBy: { created_at: 'desc' },
    take: 50,
    select: { id: true, created_by: true, goal: true },
  });
  const byUser = new Map<string, typeof recent>();
  for (const t of recent) {
    const list = byUser.get(t.created_by) ?? [];
    list.push(t);
    byUser.set(t.created_by, list);
  }
  const rapid = [...byUser.entries()].filter(([, tasks]) => tasks.length >= 3);
  if (rapid.length === 0) { ok('User failure patterns'); return; }
  warn('Rapid failures', `${rapid.length} user(s) with 3+ consecutive failures`);
  for (const [user, tasks] of rapid.slice(0, 3)) {
    warn(`  user ${user.slice(0, 12)}`, `${tasks.length} recent failures`);
  }
}

async function main() {
  console.log(`${CYAN}╒══════════════════════════════════════╕${RESET}`);
  console.log(`${CYAN}│  Edge Case Finder — Spoke Health   │${RESET}`);
  console.log(`${CYAN}╘══════════════════════════════════════╛${RESET}\n`);

  const t0 = Date.now();

  await checkStuckRunningTasks();
  await checkPendingOverdue();
  await checkZombieSandboxes();
  await checkExcessiveRetries();
  await checkCostAnomalies();
  await checkUnusualGoals();
  await checkFailedTaskRuns();
  await checkProvenanceGaps();
  await checkRapidFailures();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n${exitCode === 0 ? `${CYAN}✓ All clean` : `${RED}✖ Issues found`}${RESET} ${DIM}(${elapsed}s)${RESET}`);
  process.exit(exitCode);
}

main().catch(err => {
  console.error(`${RED}edge-case-finder crashed:${RESET}`, err);
  process.exit(1);
});
