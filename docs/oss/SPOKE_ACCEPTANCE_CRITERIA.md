# SPOKE — Acceptance Criteria

Happy Path · Sad Path · Edge Cases

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Features covered | F-01 Slack Entry · F-02 Agent Execution · F-03 Verification Gates · F-04 Provenance · F-05 Operator UI & Kill Switch · F-06 SSO Login · F-07 Cost Governance · F-08 RBAC |
| Format | Gherkin (Given / When / Then) |
| Scenarios per feature | 1 Happy Path · 2–3 Sad Paths · 2–3 Edge Cases |

### Legend

| Label | Meaning |
|-------|---------|
| ✅ | **HAPPY PATH** — Expected, successful flow. All preconditions met. System behaves correctly. |
| ❌ | **SAD PATH** — Failure or error condition. System must fail gracefully with a clear message. |
| ⚠️ | **EDGE CASE** — Unusual but valid input. Boundary conditions. Concurrent operations. Timeout handling. |

---

## F-01: Slack Entry Point

An engineer sends `@spoke <goal>` in a Slack channel. Spoke verifies the message, creates a task, and acknowledges within 2 seconds.

### ✅ HAPPY PATH — Engineer submits a valid goal via Slack

**Given** the Spoke bot is installed in the #engineering Slack channel
And the Slack signing secret is valid and configured
And the repository github.com/org/api is accessible via GH_TOKEN
**When** an engineer sends "@spoke add JWT authentication to the Express API"
**Then** Spoke verifies the Slack signature within 500ms
And a task record is created in the database with status = pending
And the task goal is stored as "add JWT authentication to the Express API"
And a Temporal workflow is started with the task ID
And Spoke replies in Slack within 2 seconds: "✅ Task task_01ABC created. Running now."
And the reply contains a link to the task in the Operator UI

### ❌ SAD PATH — Message has invalid Slack signature

**Given** the Spoke bot receives a POST to /slack/events
**When** the X-Slack-Signature header does not match the computed HMAC
**Then** Spoke returns HTTP 401 with body `{ ok: false, error: "Invalid signature" }`
And no task is created in the database
And no Temporal workflow is started
But no error is sent to the Slack channel

### ❌ SAD PATH — Goal text is empty

**Given** the engineer sends "@spoke" with no goal text
**When** Spoke parses the message body
**Then** Spoke replies: "❌ Please provide a goal. Example: @spoke add JWT auth"
And no task is created
And status code 200 is returned to Slack (to avoid Slack retry storms)

### ❌ SAD PATH — Bot is not a member of the channel

**Given** an engineer sends "@spoke add tests" in a channel the bot has not joined
**When** Slack delivers the event to the Spoke webhook
**Then** Spoke logs a warning: "bot_not_in_channel: C123"
And no task is created
And no reply is sent (bot cannot post to the channel)

### ⚠️ EDGE CASE — Goal contains special characters and emojis

**Given** the engineer sends "@spoke fix the 🐛 in the auth/login route — it's returning 500"
**When** Spoke parses the message
**Then** the goal is stored exactly as "fix the 🐛 in the auth/login route — it's returning 500"
And the task is created and acknowledged normally
And the agent receives the full goal including emoji and punctuation

### ⚠️ EDGE CASE — Same user submits two identical goals within 5 seconds

**Given** an engineer sends "@spoke add tests" twice within 5 seconds (double-tap)
**When** both Slack events arrive at the Spoke webhook
**Then** the first event creates task_01 normally
And the second event is deduplicated by Slack event ID
And only one task is created in the database
And Spoke replies once, not twice

### ⚠️ EDGE CASE — Goal is submitted in a Slack thread, not a channel message

**Given** an engineer replies "@spoke add auth" inside a thread on an existing message
**When** Spoke receives the event
**Then** the task is created normally (thread_ts is stored as context)
And Spoke replies inside the same thread
And the operator UI shows the Slack thread link in the task metadata

---

## F-02: Sandboxed Agent Execution

The Temporal workflow provisions an E2B sandbox, clones the repository, runs the Claude agent loop, and completes the task.

### ✅ HAPPY PATH — Agent successfully implements a feature end-to-end

**Given** task_01 exists with status = pending and goal = "add JWT auth to Express API"
And the E2B API key is valid and has sufficient quota
And the repository is a public GitHub repo with Node.js project
**When** the Temporal worker picks up the agentTaskWorkflow
**Then** an E2B sandbox is provisioned within 30 seconds
And the repository is cloned into /workspace in the sandbox
And the Claude agent generates a plan with 3–8 implementation steps
And the agent executes each step using shell, file_read, and file_write tools
And all tool calls are logged to the provenance table in real time
And the task status updates: provisioning → planning → executing → verifying → pushing → completed
And the final PR URL is stored in the pull_requests table
And the E2B sandbox is destroyed within 60 seconds of task completion
And total cost is under $3.00

### ❌ SAD PATH — E2B sandbox fails to provision within 30 seconds

**Given** the E2B API is experiencing degraded performance
**When** Spoke calls Sandbox.create() and receives a timeout after 30 seconds
**Then** the activity throws SandboxProvisionError
And Temporal retries the provisionSandbox activity up to 3 times with exponential backoff
And after 3 failures the workflow transitions to status = failed
And the operator sees "Sandbox provisioning failed after 3 attempts" in the UI
And Slack sends a failure notification to the original channel
And no orphaned sandbox is left running

### ❌ SAD PATH — Repository is private and GH_TOKEN lacks access

**Given** the task goal references github.com/org/private-repo
And GH_TOKEN does not have read access to that repository
**When** the agent runs git clone in the E2B sandbox
**Then** git returns exit code 128 with "Repository not found"
And the activity throws RepoAccessError
And the workflow fails immediately (no retry — this is not transient)
And the operator sees "Repository not accessible: check GH_TOKEN permissions"
And the sandbox is destroyed

### ❌ SAD PATH — Claude API returns rate limit error mid-task

**Given** the agent is mid-execution on step 4 of 8
**When** OpenRouter returns HTTP 429 Too Many Requests
**Then** the agent loop catches the error and waits with exponential backoff (1s, 2s, 4s)
And after 3 retries the activity fails
And Temporal retries the runAgent activity from the beginning of the step
And the task continues if the retry succeeds within the 15-minute timeout
And if retries are exhausted the task transitions to status = failed

### ⚠️ EDGE CASE — Repository has no package.json (non-Node.js project)

**Given** the task goal is "add rate limiting to the Flask API"
And the repository is a Python project with requirements.txt
**When** the agent provisions the sandbox with the default Node.js template
**Then** the agent detects Python project from repository structure
And the agent uses the correct commands (pip install, pytest) instead of npm
And the task completes successfully
And the provenance log records the detected language as "python"

### ⚠️ EDGE CASE — Agent reaches the $5 cost cap before completing

**Given** the task is unusually complex and the agent has used $4.95 in model calls
**When** the agent attempts to make another model API call
**Then** the cost cap enforcer throws CostCapExceededError
And the agent loop terminates immediately
And the task transitions to status = failed with reason = "cost_cap_exceeded"
And the operator sees the actual cost ($4.95) and the cap ($5.00) in the UI
And the sandbox is destroyed cleanly
And Slack notifies the engineer: "Task stopped: cost cap reached ($4.95 / $5.00)"

### ⚠️ EDGE CASE — Agent generates code but forgets to save a file

**Given** the agent generates the content for auth.ts in its reasoning
But the file_write tool call fails due to a sandbox filesystem error
**When** the verification gate runs npm test
**Then** tests fail because auth.ts does not exist
And the agent receives the test failure output and retries the file_write
And if the retry succeeds the task continues
And if the retry fails 3 times the task is marked failed with reason = "filesystem_error"

---

## F-03: Verification Gates

Before any PR is opened, Spoke runs lint, TypeScript typecheck, and the test suite inside the sandbox. All gates must pass.

### ✅ HAPPY PATH — All verification gates pass and PR is opened

**Given** the agent has finished writing code and committed it to branch feat/task_01
**When** the verify activity runs in the E2B sandbox
**Then** pnpm lint exits with code 0 and no errors
And pnpm typecheck exits with code 0 and no type errors
And pnpm test exits with code 0 and all tests pass
And the verification result is logged to provenance with passed = true
And the workflow proceeds to the pushBranch and createPr activities
And the operator UI shows green checkmarks for all three gates

### ❌ SAD PATH — TypeScript typecheck fails — no PR opened

**Given** the agent added a function with an incorrect return type
**When** pnpm typecheck runs in the sandbox
**Then** TypeScript reports "Type string is not assignable to type number" on line 42
And the verification gate records passed = false with the full error output
And the agent receives the TypeScript error and attempts to fix it
And if the fix is successful verification reruns
And if verification fails 3 times the task transitions to status = failed
But no branch is pushed and no PR is opened at any point during failure

### ❌ SAD PATH — Test suite fails — agent retries

**Given** the agent has implemented JWT auth but the existing login test now fails
**When** pnpm test runs and 2 of 15 tests fail
**Then** the agent receives the full test output (failing test names and stack traces)
And the agent attempts to fix the failing tests or update the implementation
And verification reruns after each fix attempt
And if tests pass on retry the PR is opened
And if 3 retry cycles all fail the task is marked failed with the test output attached

### ⚠️ EDGE CASE — Repository has zero tests

**Given** the repository has no test files and no test script in package.json
**When** the verify activity runs pnpm test
**Then** npm reports "Missing script: test" and exits with code 1
And Spoke treats "no test script" as a special case, not a failure
And the verification log notes: "No test suite found — skipping test gate"
And lint and typecheck still run and must pass
And the PR is opened with a comment: "⚠️ No test suite found — tests skipped"

### ⚠️ EDGE CASE — Tests are flaky — pass on second run

**Given** the repository has a known flaky test that fails ~20% of the time
**When** pnpm test fails on first run due to a race condition in the flaky test
**Then** Spoke automatically retries the test run once
And if the retry passes the task continues to PR creation
And the provenance log records: "Test flake detected — passed on retry 2"
And the operator can see both runs in the trace view

### ⚠️ EDGE CASE — Lint produces warnings but no errors

**Given** the generated code has 3 ESLint warnings (not errors)
**When** pnpm lint runs with `--max-warnings=0` not configured
**Then** lint exits with code 0 (warnings do not fail the gate by default)
And the lint gate is marked as passed
And the provenance log records the warning count
And the PR description includes: "3 lint warnings (non-blocking)"

---

## F-04: Provenance and Trace Logging

Every agent action is logged immutably. The operator can replay the exact sequence of events for any task.

### ✅ HAPPY PATH — Complete trace is visible after task completion

**Given** task_01 has completed with status = completed
**When** the operator opens the task trace in the Operator UI
**Then** every provenance event is displayed in chronological order
And events include: TASK_STARTED, SANDBOX_CREATED, REPO_CLONED, MODEL_CALLED (×N), TOOL_CALLED (×N), VERIFICATION_RAN, GIT_COMMITTED, PR_CREATED, SANDBOX_DESTROYED
And each MODEL_CALLED event shows: model name, token count, cost in USD
And each TOOL_CALLED event shows: tool name, input, exit code or output
And each VERIFICATION_RAN event shows: gate name, passed/failed, output snippet
And the total cost and duration are shown in the summary header

### ❌ SAD PATH — Provenance write fails mid-task (database unavailable)

**Given** Cloud SQL experiences a transient connection error during task execution
**When** the provenance writer attempts to INSERT a TOOL_CALLED event
**Then** the write is retried up to 3 times with 500ms backoff
And if all retries fail the provenance event is queued in memory
And the task continues executing (provenance failure does not stop the agent)
And queued events are flushed when the database recovers
And a provenance_gap flag is recorded so operators know the trace may be incomplete

### ⚠️ EDGE CASE — Operator tries to delete a provenance record

**Given** an operator calls DELETE /api/provenance/event_01ABC via the API
**When** Spoke processes the request
**Then** the API returns HTTP 405 Method Not Allowed
And the database row is not deleted
And the audit log records the attempted deletion and who attempted it
And the error message states: "Provenance records are immutable"

### ⚠️ EDGE CASE — Tool output is very large (>1MB response)

**Given** the agent runs a shell command that produces 2MB of stdout
**When** the TOOL_CALLED provenance event is written
**Then** the output is truncated to the first 10,000 characters
And the truncation is noted: "[output truncated — 2.1MB total]"
And the full output is stored in Cloud Storage and linked from the provenance record
And the trace view shows the truncated output with a "View full output" link

---

## F-05: Operator UI and Kill Switch

The operator can see all running tasks in real time and kill any task within 10 seconds.

### ✅ HAPPY PATH — Operator kills a running task within 10 seconds

**Given** task_01 is in status = executing with an active E2B sandbox
And the operator is viewing the fleet dashboard in the Operator UI
**When** the operator clicks the "Kill" button on task_01 and confirms the dialog
**Then** the UI sends DELETE /api/tasks/task_01/kill
And the API sends a kill signal to the Temporal workflow within 1 second
And the Temporal workflow receives the signal and aborts the agent loop
And the E2B sandbox is destroyed within 5 seconds of the kill signal
And the task status transitions to killed within 10 seconds of the button click
And the Operator UI updates to show status = killed in real time via SSE
And Slack sends a notification: "⚡ task_01 killed by operator@company.com"
And the provenance log records: TASK_KILLED operator=operator@company.com reason=manual

### ❌ SAD PATH — Operator tries to kill an already-completed task

**Given** task_01 has status = completed and no active sandbox
**When** the operator clicks "Kill" on task_01
**Then** the UI shows: "This task has already completed and cannot be killed"
And the API returns HTTP 409 Conflict with body `{ error: "task_already_completed" }`
And no kill signal is sent to Temporal
And the task status remains completed

### ❌ SAD PATH — Kill signal sent but Temporal is unreachable

**Given** Temporal Cloud is experiencing an outage
**When** the operator sends a kill command for task_01
**Then** the API attempts to signal Temporal and receives a connection error
And the API retries the signal 3 times with 2-second backoff
And if all retries fail the API returns HTTP 503 with body `{ error: "orchestrator_unreachable" }`
And the operator UI shows: "Kill signal could not be delivered — try again in 30s"
And the E2B sandbox continues running until Temporal recovers or the task timeout is reached

### ⚠️ EDGE CASE — Two operators kill the same task simultaneously

**Given** operator A and operator B both click "Kill" on task_01 at the same time
**When** two DELETE /api/tasks/task_01/kill requests arrive within milliseconds
**Then** the first request acquires a database lock and sends the kill signal
And the second request detects the task is already being killed and returns HTTP 200 with `{ ok: true, note: "already_killing" }`
And only one TASK_KILLED provenance event is written
And the first operator who clicked is recorded as the killer

### ⚠️ EDGE CASE — Kill requested during sandbox provisioning (before agent starts)

**Given** task_01 is in status = provisioning and the E2B sandbox is not yet ready
**When** the operator sends a kill command
**Then** the Temporal workflow receives the signal and aborts before starting the agent loop
And the partially provisioned sandbox is destroyed via a cleanup activity
And the task transitions to status = killed
And total cost is $0.00 (no model calls were made)

---

## F-06: SSO Login (Spoke Cloud — Enterprise)

Enterprise operators sign in via their company identity provider (Google Workspace, Okta, Azure AD). No local passwords.

### ✅ HAPPY PATH — Operator signs in via Google Workspace SSO

**Given** the organisation has configured Google Workspace as the SSO provider
And the operator's email operator@ford.com belongs to the ford.com Google Workspace
**When** the operator clicks "Sign in with SSO" on the Spoke Cloud login page
**Then** the browser redirects to Google's OAuth2 authorisation endpoint
And the operator signs in with their Google account
And Google redirects back to Spoke with an authorisation code
And Spoke exchanges the code for an ID token and verifies the signature
And the operator's email domain (ford.com) is matched to the Ford organisation in Spoke
And a session is created with the operator's role (as configured in RBAC)
And the operator is redirected to the fleet dashboard within 3 seconds

### ❌ SAD PATH — SSO provider is down during login attempt

**Given** Okta is experiencing a service outage
**When** the operator clicks "Sign in with SSO" and is redirected to Okta
**Then** Okta returns an error page or timeout
And Spoke detects the OAuth callback contains an error parameter
And Spoke redirects to the login page with message: "Your identity provider is currently unavailable. Please try again later."
And no session is created
And Spoke logs the failed login attempt with provider=okta and error=provider_unavailable

### ❌ SAD PATH — User is not in the authorised organisation

**Given** the operator's Google account personal@gmail.com is not a ford.com Workspace account
**When** the operator signs in with personal@gmail.com via Google SSO
**Then** Google successfully authenticates the user
And Spoke checks the email domain: gmail.com does not match any configured organisation
And Spoke returns: "Your account (personal@gmail.com) is not authorised for this organisation"
And no session is created
And the failed login is logged for the security audit trail

### ❌ SAD PATH — SSO session token expires mid-session

**Given** an operator has been active for 8 hours (token expiry is 8 hours)
**When** the operator makes an API call after the token has expired
**Then** the API returns HTTP 401 with body `{ error: "session_expired" }`
And the Operator UI detects the 401 and redirects to the SSO login page automatically
And after re-authentication the operator is returned to the same page they were on

### ⚠️ EDGE CASE — Operator switches from one SSO provider to another (Okta → Google)

**Given** the organisation changes their SSO provider from Okta to Google Workspace
And the admin updates the SSO configuration in Spoke settings
**When** an existing operator who previously logged in via Okta now logs in via Google
**Then** Spoke matches the operator by email address (the email is the same)
And the operator's account, role, and history are preserved
And no duplicate account is created
And the login method shown in audit logs changes from okta to google

### ⚠️ EDGE CASE — JIT provisioning — first-ever login for a new team member

**Given** a new engineer alice@ford.com has never logged into Spoke before
**When** Alice signs in via the Ford Okta SSO for the first time
**Then** Spoke creates a new user account for alice@ford.com automatically (JIT provisioning)
And Alice is assigned the default role: operator (as configured by the admin)
And Alice is added to the Ford organisation
And Alice is redirected to the fleet dashboard with a welcome message
And the admin receives an email: "New operator alice@ford.com joined via SSO"

---

## F-07: Cost Governance

Operators set cost caps per task and per team. The system enforces these limits and provides real-time cost visibility.

### ✅ HAPPY PATH — Task completes within cost cap — cost is tracked accurately

**Given** the task-level cost cap is set to $5.00
And the organisation's monthly team budget is $500
**When** task_01 completes using $1.34 in model calls and $0.10 in sandbox time
**Then** the total task cost $1.44 is stored in the task record
And the organisation's monthly spend counter increases by $1.44
And the cost dashboard reflects the new spend in real time
And the operator sees: "$1.44 / $5.00 cap used (28%)"
And the team budget dashboard shows: "$1.44 / $500 monthly budget used"

### ❌ SAD PATH — Task hits the per-task cost cap mid-execution

**Given** the task cost cap is $5.00
And the agent has already spent $4.95 on model calls
**When** the cost cap enforcer checks before making the next model call
**Then** CostCapExceededError is thrown with current_cost=$4.95 and cap=$5.00
And the agent loop terminates immediately without making the model call
And the task transitions to status = failed with reason = cost_cap_exceeded
And the sandbox is destroyed
And the operator UI shows: "Task failed: cost cap reached ($4.95 of $5.00)"
And Slack notifies the engineer: "Task stopped — cost cap reached. Consider increasing the cap or simplifying the goal."

### ❌ SAD PATH — Team monthly budget is exhausted

**Given** the Platform team has a $200/month budget and has already spent $197
**When** an engineer submits a new task "@spoke refactor the entire auth module"
**Then** Spoke checks the team budget before starting the workflow
And $200 - $197 = $3 remaining, which is below the default task cap of $5
And Spoke rejects the task with: "Team budget nearly exhausted ($3 remaining). Reduce the task cap or request a budget increase."
And no task is created in the database
And no sandbox is provisioned
And the operator (not the engineer) is notified via email

### ⚠️ EDGE CASE — Multiple tasks run in parallel, team budget is exhausted mid-execution

**Given** 3 tasks are running simultaneously for the Platform team
And the team budget is $500 and current spend is $490
**When** all 3 tasks generate $5 in costs simultaneously (total: $15 potential overage)
**Then** the first task to check the budget ($490 → $495) is allowed to continue
And the second task to check ($495 → $500) is allowed (still within budget)
And the third task to check ($500 → $505) receives CostCapExceededError
And the third task stops immediately and is marked failed with reason = team_budget_exhausted
And the first two tasks are allowed to complete
And the final spend is approximately $510 (small overage accepted due to atomicity constraints)
And the overage is logged and shown in the cost dashboard

### ⚠️ EDGE CASE — Admin changes the cost cap while a task is running

**Given** task_01 is running with a $5.00 cap
And the task has spent $3.00 so far
**When** the admin reduces the task cap to $2.00 via the settings UI
**Then** the new cap is applied to future tasks, not the current running task
And task_01 continues with its original $5.00 cap
And the settings UI shows: "New cap ($2.00) will apply to tasks started after this change"
And a warning is shown if any currently-running tasks exceed the new cap

---

## F-08: Role-Based Access Control (Enterprise Cloud)

Enterprise operators have roles (admin, operator, viewer) that control what they can see and do. Teams scope access to specific repositories and budgets.

### ✅ HAPPY PATH — Operator with correct role kills a task in their team

**Given** alice@ford.com has the operator role in the Platform team
And task_01 belongs to the Platform team
**When** Alice sends a kill command for task_01
**Then** RBAC checks: role=operator, team=platform, action=kill_task → ALLOW
And the kill command is executed
And the audit log records: alice@ford.com killed task_01 (role=operator, team=platform)

### ❌ SAD PATH — Viewer tries to kill a task — denied

**Given** bob@ford.com has the viewer role
**When** Bob sends DELETE /api/tasks/task_01/kill
**Then** RBAC checks: role=viewer, action=kill_task → DENY
And the API returns HTTP 403 Forbidden with body `{ error: "insufficient_permissions", required_role: "operator" }`
And no kill signal is sent
And the denied action is recorded in the audit log
And Bob sees: "You do not have permission to kill tasks. Contact your admin."

### ❌ SAD PATH — Operator tries to access another team's tasks

**Given** alice@ford.com is an operator in the Platform team only
And task_99 belongs to the Frontend team
**When** Alice navigates to /tasks/task_99 in the Operator UI
**Then** RBAC checks: team=frontend, alice is not a member → DENY
And the API returns HTTP 404 (not 403, to avoid information disclosure)
And the UI shows: "Task not found"
And the access attempt is logged in the audit trail

### ⚠️ EDGE CASE — Admin demotes an operator to viewer while they have a task running

**Given** alice@ford.com is an operator with 2 tasks running
**When** the admin changes Alice's role from operator to viewer
**Then** the 2 running tasks continue to completion (in-flight tasks are not killed by role change)
And Alice's session is invalidated on the next API call
And Alice is prompted to re-authenticate
And after re-authentication Alice has the viewer role and cannot kill tasks
And the role change is logged: admin@ford.com changed alice@ford.com from operator to viewer
