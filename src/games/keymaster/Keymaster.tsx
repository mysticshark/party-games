"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../registry";
import { playSwap, playFanfare, playWrong } from "@/lib/sounds";

interface KeymasterState {
  phase?: "lobby" | "playing" | "results";
  round?: number;
  keyCount?: number;
  sequence?: string[];
  startedAt?: number | null;
  results?: Array<{ id: string; name: string; ms: number }>;
  hostId?: string | null;
  players?: Record<string, { name: string; done: boolean }>;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Keymaster({ socket, me, members, game }: GameProps) {
  const g = game as KeymasterState;
  const phase = g.phase ?? "lobby";
  const round = g.round ?? 0;
  const keyCount = g.keyCount ?? 1;
  const sequence = g.sequence ?? [];
  const startedAt = g.startedAt ?? null;
  const results = g.results ?? [];
  const players = g.players ?? {};
  const isHost = !!me && g.hostId === me.id;

  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [setupKeyCount, setSetupKeyCount] = useState(1);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);

  // Reset local state when a new round starts
  const sequenceKey = sequence.join("");
  useEffect(() => {
    if (phase === "playing") {
      setProgress(0);
      setDone(false);
      setWrongFlash(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sequenceKey]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "playing" || startedAt === null) {
      setCountdownLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, startedAt - Date.now());
      setCountdownLeft(left);
      if (left <= 0) clearInterval(id);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  // Use a ref to access current state inside the event listener without re-registering
  const stateRef = useRef({ progress, done, countdownLeft, sequence, startedAt });
  stateRef.current = { progress, done, countdownLeft, sequence, startedAt };

  // Keydown listener
  useEffect(() => {
    if (phase !== "playing") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        ["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "Escape",
         "Enter", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
          .includes(e.key)
      ) return;

      const { done: isDone, countdownLeft: left, sequence: seq, progress: prog } = stateRef.current;
      if (isDone || (left !== null && left > 0)) return;

      e.preventDefault();
      const key = e.key.toUpperCase();
      const expected = seq[prog];

      if (key === expected) {
        const newProgress = prog + 1;
        setProgress(newProgress);
        playSwap();
        if (newProgress === seq.length) {
          setDone(true);
          socket.emit("km:done", { typed: seq });
          playFanfare();
        }
      } else {
        setProgress(0);
        setWrongFlash(true);
        playWrong();
        setTimeout(() => setWrongFlash(false), 300);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, socket]);

  // ---- Lobby ----------------------------------------------------------------
  if (phase === "lobby") {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 text-5xl">⌨️</div>
        {isHost ? (
          <>
            <h2 className="mb-2 text-2xl font-black">Start Keymaster</h2>
            <p className="mb-6 text-violet-100/60">
              A sequence of keys appears on screen. Everyone races to type them in order.
              Fastest fingers win — timed to the millisecond.
            </p>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-100/40">
              Starting key count
            </p>
            <div className="mb-6 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setSetupKeyCount(n)}
                  className={`h-12 w-12 rounded-xl border text-lg font-bold transition ${
                    setupKeyCount === n
                      ? "border-sky-400 bg-sky-400/20 text-white"
                      : "border-white/10 bg-white/5 text-violet-100/60 hover:bg-white/10"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => socket.emit("km:start", { keyCount: setupKeyCount })}
              className="rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 px-8 py-4 text-lg font-black uppercase tracking-wide shadow-lg transition hover:scale-105"
            >
              Start Game
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-2xl font-black">Waiting for the host…</h2>
            <p className="text-violet-100/60">
              A sequence of keys will appear on screen. Type them in order as fast as you can.
              Fastest fingers win — timed to the millisecond.
            </p>
          </>
        )}
      </div>
    );
  }

  // ---- Results --------------------------------------------------------------
  if (phase === "results") {
    const finishedIds = new Set(results.map((r) => r.id));
    const dnf = members.filter((m) => !finishedIds.has(m.id));

    return (
      <div className="mx-auto max-w-lg">
        <h2 className="mb-6 text-center text-2xl font-black">
          Round {round} results
        </h2>
        <ul className="mb-6 flex flex-col gap-2">
          {results.map((r, idx) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
            >
              <span className="font-semibold">
                {MEDALS[idx] ?? `#${idx + 1}`} {r.name}
                {r.id === me?.id && (
                  <span className="ml-1 text-xs text-sky-300/70">(you)</span>
                )}
              </span>
              <span className="font-mono text-sky-300">{r.ms} ms</span>
            </li>
          ))}
          {dnf.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-violet-100/40"
            >
              <span>— {m.name}{m.id === me?.id && <span className="ml-1 text-xs">(you)</span>}</span>
              <span className="font-mono">—</span>
            </li>
          ))}
        </ul>

        {isHost && (
          <div className="flex flex-wrap justify-center gap-2 border-t border-white/10 pt-4">
            <button
              onClick={() => socket.emit("km:next", { increaseKeys: true })}
              disabled={keyCount >= 8}
              className="rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 px-4 py-2 text-sm font-semibold shadow transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
            >
              Next Round (+1 key)
            </button>
            <button
              onClick={() => socket.emit("km:next", { increaseKeys: false })}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
            >
              Next Round (same {keyCount} {keyCount !== 1 ? "keys" : "key"})
            </button>
            <button
              onClick={() => socket.emit("km:restart")}
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-violet-100/60 transition hover:bg-white/10"
            >
              Back to Lobby
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- Playing --------------------------------------------------------------
  const countingDown = countdownLeft !== null && countdownLeft > 0;
  const finishedIds = new Set(results.map((r) => r.id));
  const myResult = results.find((r) => r.id === me?.id);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_200px]">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-100/40">
          Round {round} · {keyCount} {keyCount !== 1 ? "keys" : "key"}
        </p>

        {/* Key sequence */}
        <div className="relative my-8 flex justify-center gap-3">
          {sequence.map((key, i) => {
            const isTyped = i < progress;
            const isCurrent = i === progress;
            const isFlashing = wrongFlash && isCurrent;

            return (
              <div
                key={i}
                className={`flex h-16 w-16 items-center justify-center rounded-xl border-2 text-2xl font-black font-mono transition ${
                  isFlashing
                    ? "border-red-400 bg-red-400/20 text-red-300"
                    : isTyped
                      ? "border-sky-400 bg-sky-400/20 text-sky-300"
                      : isCurrent
                        ? "border-white bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                        : "border-white/20 bg-white/5 text-white/60"
                }`}
              >
                {isTyped ? "✓" : key}
              </div>
            );
          })}

          {/* Countdown overlay */}
          {countingDown && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
              <span className="text-6xl font-black text-white">
                {Math.ceil(countdownLeft! / 1000)}
              </span>
              <span className="mt-1 text-sm text-violet-100/60">Get ready…</span>
            </div>
          )}
        </div>

        {/* Status text */}
        <p className="text-center text-sm text-violet-100/60">
          {countingDown
            ? "Get ready…"
            : done
              ? `✅ Done! Waiting for others… ${myResult ? `Your time: ${myResult.ms} ms` : ""}`
              : "Type the keys in order!"}
        </p>
      </div>

      {/* Results sidebar */}
      <aside>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-100/40">
          Finished
        </h3>
        <ul className="flex flex-col gap-2">
          {results.map((r, idx) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <span className="truncate">
                {MEDALS[idx] ?? "✅"} {r.name}
                {r.id === me?.id && <span className="ml-1 text-xs text-sky-300/70">(you)</span>}
              </span>
              <span className="shrink-0 font-mono text-xs text-violet-100/50">{r.ms} ms</span>
            </li>
          ))}
          {members
            .filter((m) => !finishedIds.has(m.id))
            .map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-violet-100/40"
              >
                <span className="truncate">
                  … {m.name}
                  {m.id === me?.id && <span className="ml-1 text-xs">(you)</span>}
                </span>
              </li>
            ))}
        </ul>
      </aside>
    </div>
  );
}
