"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Task } from "@harness/shared";

interface ReplayEvent {
  time: number;
  label: string;
  type: "model_call" | "tool_use" | "file_edit" | "test" | "thought" | "milestone";
  detail: string;
}

function generateReplayEvents(task: Task): ReplayEvent[] {
  const baseTime = 0;
  const events: ReplayEvent[] = [];
  const rng = (seed: number) => {
    let s = seed;
    return (max: number) => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return (s % max);
    };
  };
  const r = rng(task.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0));

  const steps = Math.max(r(12) + 4, 4);
  let t = baseTime;
  const types: ReplayEvent["type"][] = ["thought", "model_call", "tool_use", "file_edit", "thought", "test", "milestone", "tool_use", "thought", "model_call"];

  for (let i = 0; i < steps; i++) {
    t += r(30) + 5;
    const type = types[i % types.length];
    const labels: Record<ReplayEvent["type"], string[]> = {
      thought: ["Analyzing code structure...", "Reading file dependencies...", "Considering approach...", "Reviewing test output..."],
      model_call: [`Claude Sonnet — ${r(2000) + 200} tokens`, `Claude Haiku — ${r(800) + 100} tokens`],
      tool_use: [`read_file: src/auth/${["login.ts", "middleware.ts", "session.ts", "config.ts"][i % 4]}`, `list_files: src/${["components", "lib", "pages", "utils"][i % 4]}`, `grep: "apiKey"`, `glob: "**/*.config.*"`],
      file_edit: [`src/auth/login.ts — +${r(15) + 2} / -${r(5)} lines`, `src/middleware.ts — +${r(8) + 1} / -${r(3)} lines`],
      test: [`Running: ${["auth", "api", "integration", "unit"][i % 4]} tests...`, `${r(50) + 10} tests passed, ${r(3)} failed`],
      milestone: [`Spawning agent (${r(5) + 1}/3)`, "Sandbox ready", "Processing results", "Generating PR summary"],
    };
    const label = labels[type][i % labels[type].length];
    const detail = "";
    events.push({ time: t, label, type, detail });
  }

  return events;
}

const TYPE_ICONS: Record<string, string> = {
  thought: "💭",
  model_call: "🤖",
  tool_use: "🔧",
  file_edit: "📝",
  test: "🧪",
  milestone: "🎯",
};

export default function ReplayPage() {
  const params = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const taskId = params.id as string;

  useEffect(() => {
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((t: Task) => {
        setTask(t);
        setEvents(generateReplayEvents(t));
      })
      .catch(() => {});
  }, [taskId]);

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (currentIndex >= events.length - 1) {
      stopPlayback();
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => {
        if (i >= events.length - 1) {
          stopPlayback();
          return i;
        }
        return i + 1;
      });
    }, 800 / speed);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, currentIndex, events.length, speed, stopPlayback]);

  const seek = (idx: number) => {
    setCurrentIndex(Math.min(idx, events.length - 1));
  };

  const togglePlay = () => {
    if (playing) stopPlayback();
    else startPlayback();
  };

  const reset = () => {
    stopPlayback();
    setCurrentIndex(0);
  };

  const currentEvent = events[currentIndex];
  const progress = events.length > 0 ? ((currentIndex + 1) / events.length) * 100 : 0;
  const totalTime = events.length > 0 ? events[events.length - 1].time : 0;
  const currentTime = currentEvent?.time ?? 0;

  if (!task) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 select-none">
      {/* Playback Controls Bar */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Replay
          </span>

          <span className="font-mono text-xs text-gray-400">{taskId.slice(0, 12)}...</span>

          <div className="ml-auto flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={reset}
              disabled={currentIndex === 0}
              className="rounded p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors"
              title="Reset"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 4v16m12-16v16" />
              </svg>
            </button>

            <button
              onClick={() => seek(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="rounded p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors"
              title="Previous step"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={togglePlay}
              className="rounded-full bg-blue-600 p-2 text-white hover:bg-blue-500 transition-colors"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>

            <button
              onClick={() => seek(Math.min(events.length - 1, currentIndex + 1))}
              disabled={currentIndex >= events.length - 1}
              className="rounded p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors"
              title="Next step"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="ml-2 h-6 w-px bg-gray-700" />

            {/* Speed Controls */}
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  speed === s ? "bg-blue-600/20 text-blue-400" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl">
        {/* Left — Timeline */}
        <div className="w-2/3 border-r border-gray-800">
          {/* Scrubber */}
          <div className="border-b border-gray-800 px-6 py-3">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span>T+{currentTime}s</span>
              <span>{currentIndex + 1} / {events.length}</span>
              <span>T+{totalTime}s</span>
            </div>
            <div className="relative h-2 cursor-pointer rounded-full bg-gray-800" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              seek(Math.floor(pct * events.length));
            }}>
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-blue-400 bg-blue-600"
                style={{ left: `calc(${progress}% - 7px)` }}
              />
            </div>
          </div>

          {/* Events */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
            <div className="relative px-6 py-4">
              <div className="absolute left-[30px] top-0 h-full w-px bg-gray-800" />
              {events.map((ev, i) => {
                const isCurrent = i === currentIndex;
                const isPast = i < currentIndex;
                return (
                  <div
                    key={i}
                    onClick={() => seek(i)}
                    className={`relative flex cursor-pointer items-start gap-4 py-2 pl-0 transition-opacity ${
                      isPast ? "opacity-40" : isCurrent ? "opacity-100" : "opacity-70 hover:opacity-90"
                    }`}
                  >
                    <div className={`relative z-10 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      isCurrent ? "bg-blue-600 ring-2 ring-blue-400/50" : "bg-gray-800"
                    }`}>
                      {TYPE_ICONS[ev.type] ?? "•"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium ${
                          isCurrent ? "text-blue-300" : "text-gray-300"
                        }`}>
                          {ev.label}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-600">
                          T+{ev.time}s
                        </span>
                      </div>
                      {ev.detail && (
                        <div className="mt-0.5 text-[11px] text-gray-500">{ev.detail}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right — State Panel */}
        <div className="w-1/3 bg-gray-900/50 px-6 py-4">
          <div className="mb-4 text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Execution State
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-600">Current Step</div>
              <div className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
                {currentEvent ? currentEvent.label : "—"}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-600">Type</div>
              <div className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
                {currentEvent ? currentEvent.type : "—"}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-600">Task ID</div>
              <div className="rounded-lg bg-gray-800 px-3 py-2 font-mono text-xs text-gray-400">
                {taskId}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-600">Status</div>
              <div className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
                {task.status}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-600">Timeline</div>
              <div className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
                Step {currentIndex + 1} of {events.length}
              </div>
            </div>

            {task.status === "failed" && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-red-500">Status</div>
                <div className="rounded-lg bg-red-950/50 px-3 py-2 text-xs text-red-400">
                  Task failed
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
