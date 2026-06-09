"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Task } from "@spoke/shared";

type Command = {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setRecentTasks([]);
      fetch("/api/tasks")
        .then((r) => r.json())
        .then((tasks: Task[]) => setRecentTasks(tasks.slice(0, 5)))
        .catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = useCallback((path: string) => {
    setOpen(false);
    window.location.href = path;
  }, []);

  const commands: Command[] = [
    {
      id: "run-task",
      label: "Run Task",
      icon: "⚡",
      shortcut: "⌘N",
      action: () => navigate("/"),
    },
    {
      id: "kill-task",
      label: "Kill Selected Task",
      icon: "☠",
      shortcut: "⌘⌥K",
      action: () => navigate("/"),
    },
    {
      id: "search-traces",
      label: "Search Traces",
      icon: "🔍",
      shortcut: "⌘⇧T",
      action: () => navigate("/"),
    },
    {
      id: "search-users",
      label: "Search Users",
      icon: "👥",
      action: () => navigate("/"),
    },
    {
      id: "open-costs",
      label: "Open Cost Dashboard",
      icon: "💰",
      action: () => navigate("/"),
    },
    {
      id: "incident-mode",
      label: "Open Incident Mode",
      icon: "🚨",
      shortcut: "⌘I",
      action: () => navigate("/incident"),
    },
    {
      id: "export-audit",
      label: "Export Audit Log",
      icon: "📜",
      action: () => navigate("/"),
    },
  ];

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const allResults = [
    ...filtered.map((c) => ({ type: "command" as const, data: c })),
    ...(query
      ? []
      : recentTasks.map((t) => ({ type: "task" as const, data: t }))),
  ];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      e.preventDefault();
      const item = allResults[selectedIndex];
      if (item.type === "command") item.data.action();
      else navigate(`/tasks/${item.data.id}`);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl rounded-xl border border-gray-700/50 bg-gray-900 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none"
          />
          <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {allResults.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {filtered.length > 0 && (
            <div className="px-2">
              {filtered.map((cmd, i) => {
                const idx = allResults.findIndex(
                  (r) => r.type === "command" && r.data.id === cmd.id,
                );
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      idx === selectedIndex
                        ? "bg-blue-600/20 text-blue-300"
                        : "text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    <span className="w-5 text-center text-base">{cmd.icon}</span>
                    <span className="flex-1">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-500">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!query && recentTasks.length > 0 && (
            <>
              <div className="mt-2 border-t border-gray-800" />
              <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Recent
              </div>
              <div className="px-2">
                {recentTasks.map((task, i) => {
                  const idx = allResults.findIndex(
                    (r) => r.type === "task" && r.data.id === task.id,
                  );
                  return (
                    <button
                      key={task.id}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        idx === selectedIndex
                          ? "bg-blue-600/20 text-blue-300"
                          : "text-gray-400 hover:bg-gray-800"
                      }`}
                    >
                      <span className="w-5 text-center text-xs text-gray-600">#</span>
                      <span className="flex-1 truncate font-mono text-xs">
                        {task.id.slice(0, 12)}...
                      </span>
                      <span className="text-xs text-gray-600">{task.status}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
