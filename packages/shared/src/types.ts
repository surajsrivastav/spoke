export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'killed';

export type Task = {
  id: string;
  goal: string;
  repo_url: string;
  branch_target: string;
  status: TaskStatus;
  cost_cap_usd: number;
  total_cost_usd?: number | string;
  failure_reason?: string | null;
  team_id?: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

export type TaskRunStatus =
  | 'provisioning'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'pushing'
  | 'completed'
  | 'failed'
  | 'killed';

export type TaskRun = {
  id: string;
  task_id: string;
  attempt: number;
  sandbox_id: string | null;
  workflow_id: string;
  status: TaskRunStatus;
  total_cost_usd: number;
  total_tokens: number;
  started_at: Date;
  ended_at: Date | null;
};

export type ProvenanceType =
  | 'plan_created'
  | 'tool_called'
  | 'model_response'
  | 'verification_run'
  | 'commit_made'
  | 'pr_opened';

export type Provenance = {
  id: string;
  task_run_id: string;
  type: ProvenanceType;
  payload: Record<string, unknown>;
  cost_usd: number;
  tokens: number;
  duration_ms: number;
  created_at: Date;
};
