export type Role = "admin" | "operator" | "viewer";

export type Action =
  | "view_tasks"
  | "create_task"
  | "kill_task"
  | "manage_users"
  | "manage_settings";

const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  admin: ["view_tasks", "create_task", "kill_task", "manage_users", "manage_settings"],
  operator: ["view_tasks", "create_task", "kill_task"],
  viewer: ["view_tasks"],
};

/** Minimum role that grants an action, used in error responses. */
export const REQUIRED_ROLE: Record<Action, Role> = {
  view_tasks: "viewer",
  create_task: "operator",
  kill_task: "operator",
  manage_users: "admin",
  manage_settings: "admin",
};

export function can(role: string, action: Action): boolean {
  const permissions = ROLE_PERMISSIONS[role as Role];
  return permissions ? permissions.includes(action) : false;
}
