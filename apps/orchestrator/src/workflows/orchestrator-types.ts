export type SubAgentType = 'setup' | 'execute' | 'verify' | 'github' | 'cleanup';

export interface SubAgentState {
  id: string;
  type: SubAgentType;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  workflowId?: string;
  attempt: number;
  error?: string;
  output?: Record<string, unknown>;
}

export interface OrchestratorInput {
  taskId: string;
  goal: string;
  repoUrl: string;
}

// ---- Sub-agent inputs/outputs ----

export interface SetupInput {
  taskId: string;
  repoUrl: string;
}

export interface SetupOutput {
  ok: boolean;
  sandboxId: string;
  taskRunId: string;
}

export interface ExecuteInput {
  taskId: string;
  sandboxId: string;
  goal: string;
  taskRunId: string;
  prevErrors?: Record<string, unknown>;
}

export interface ExecuteOutput {
  ok: boolean;
  result: string;
}

export interface VerifyInput {
  taskId: string;
  sandboxId: string;
  taskRunId: string;
}

export interface VerifyOutput {
  ok: boolean;
  passed: boolean;
  errors: Record<string, unknown>;
}

export interface GitHubInput {
  taskId: string;
  sandboxId: string;
  repoUrl: string;
  goal: string;
  taskRunId: string;
  agentResult: string;
}

export interface GitHubOutput {
  ok: boolean;
  branch: string;
  prUrl: string;
}

export interface CleanupInput {
  taskId: string;
  sandboxId: string;
}

export interface CleanupOutput {
  ok: boolean;
}
