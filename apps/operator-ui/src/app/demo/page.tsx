"use client";

import { useState } from "react";

const pipelineStages = [
  { id: "inception", label: "Inception", desc: "Parse task goal, select model, provision sandbox", color: "bg-gray-100 text-gray-700" },
  { id: "planning", label: "Planning", desc: "Agent explores repo, creates execution plan", color: "bg-blue-100 text-blue-700" },
  { id: "execution", label: "Execution", desc: "Agent implements changes, runs tools iteratively", color: "bg-indigo-100 text-indigo-700" },
  { id: "verification", label: "Verification", desc: "Lint, typecheck, and test gates", color: "bg-purple-100 text-purple-700" },
  { id: "push", label: "Push & PR", desc: "Commit changes, open pull request", color: "bg-yellow-100 text-yellow-700" },
];

const features = [
  { title: "Slack Integration", desc: "Mention @spoke with a task goal to kick off autonomous work directly from Slack." },
  { title: "WhatsApp Bridge", desc: "Send tasks via WhatsApp. The bridge forwards messages to the Spoke agent." },
  { title: "E2B Sandbox", desc: "Every task runs in an isolated E2B cloud sandbox with full filesystem access." },
  { title: "Temporal Orchestration", desc: "Reliable workflow execution with retries, signals, and observability." },
  { title: "GitHub PRs", desc: "Agents push changes and open pull requests automatically on completion." },
  { title: "Provenance Trail", desc: "Every tool call, model response, and decision is recorded for full auditability." },
];

export default function DemoPage() {
  const [goal, setGoal] = useState("");
  const [repoUrl, setRepoUrl] = useState("https://github.com/example/sample-repo");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), repo_url: repoUrl.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
        setGoal("");
      } else {
        const body = await res.text();
        setError(body || "Failed to create task");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Hero */}
      <div className="mb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Spoke
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          Autonomous coding-agent control plane. Deploy from Slack, WhatsApp, or
          the Operator UI — agents plan, code, verify, and ship PRs.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400" /> All systems nominal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-400" /> v0.1.0
          </span>
        </div>
      </div>

      {/* Architecture */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">Architecture</h2>
        <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-6 font-mono text-xs leading-relaxed text-gray-600">
          <div className="text-center">
            <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">Slack</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-green-50 px-2 py-0.5 text-green-700">slack-edge</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-purple-50 px-2 py-0.5 text-purple-700">Postgres</span>
          </div>
          <div className="text-center">
            <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">WhatsApp</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-green-50 px-2 py-0.5 text-green-700">whatsapp-edge</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-purple-50 px-2 py-0.5 text-purple-700">Postgres</span>
          </div>
          <div className="text-center">
            <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">Operator UI</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">orchestrator</span>
            <span className="mx-2">⥁</span>
            <span className="rounded bg-pink-50 px-2 py-0.5 text-pink-700">Temporal</span>
          </div>
          <div className="text-center">
            <span className="ml-24 rounded bg-amber-50 px-2 py-0.5 text-amber-700">orchestrator</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700">@spoke/agent</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">E2B Sandbox</span>
          </div>
          <div className="text-center">
            <span className="ml-24 rounded bg-amber-50 px-2 py-0.5 text-amber-700">orchestrator</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-green-50 px-2 py-0.5 text-green-700">GitHub API</span>
            <span className="mx-2">→</span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">Pull Request</span>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">Pipeline</h2>
        <div className="grid gap-4 sm:grid-cols-5">
          {pipelineStages.map((stage, i) => (
            <div key={stage.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                  {i + 1}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage.color}`}>
                  {stage.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">{stage.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">Features</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-1 text-sm font-semibold text-gray-900">{f.title}</h3>
              <p className="text-xs leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo submission */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">Try it</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {submitted ? (
            <div className="text-center">
              <p className="mb-2 text-lg font-medium text-green-700">Task submitted!</p>
              <p className="mb-4 text-sm text-gray-500">
                Check the <a href="/" className="text-blue-600 underline">fleet page</a> to monitor progress.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Submit another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="goal">
                  Task goal
                </label>
                <textarea
                  id="goal"
                  rows={3}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Add a dark mode toggle to the settings panel"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="repo">
                  Repository URL
                </label>
                <input
                  id="repo"
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !goal.trim()}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Launch agent"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
        Spoke — Agentic control plane ·{" "}
        <a href="/" className="underline hover:text-gray-600">Operator UI</a>
      </footer>
    </div>
  );
}
