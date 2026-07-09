const { test } = require("node:test");
const assert = require("node:assert");
const disordered = require("../server/games/disordered");
const { createRoom, createIo, connect, disconnect } = require("./helpers/harness");

function setup() {
  const room = createRoom("disordered");
  const io = createIo();
  const host = connect(disordered, room, io, { id: "s1", name: "Alice" });
  const p2 = connect(disordered, room, io, { id: "s2", name: "Bob" });
  return { room, io, host, p2 };
}

test("disordered: init defaults", () => {
  const room = createRoom("disordered");
  disordered.init(room);
  const g = room.game;
  assert.strictEqual(g.mode, "race");
  assert.strictEqual(g.phase, "setup");
  assert.strictEqual(g.roundId, 0);
  assert.strictEqual(g.n, 5);
  assert.deepStrictEqual(g.palette, []);
  assert.strictEqual(g.answer, null);
});

test("disordered: non-host start ignored; host start resets and starts round", () => {
  const { room, host, p2 } = setup();
  const g = room.game;
  const prevRound = g.roundId;

  p2.fire("disordered:start", { n: 5 });
  assert.strictEqual(g.phase, "setup");

  host.fire("disordered:start", { n: 5 });
  assert.strictEqual(g.phase, "playing");
  assert.strictEqual(g.roundId, prevRound + 1);
  // palette sorted
  assert.deepStrictEqual(g.palette, [...g.palette].sort());
  // per-player reset
  for (const id of Object.keys(g.players)) {
    assert.deepStrictEqual(g.players[id], { attempts: 0, solved: false, solvedAt: null });
  }
});

test("disordered: clampN bounds and palette length matches n", () => {
  for (const [input, expected] of [[1, 4], [100, 8], ["nope", 5]]) {
    const { room, host } = setup();
    host.fire("disordered:start", { n: input });
    assert.strictEqual(room.game.n, expected);
    assert.strictEqual(room.game.palette.length, room.game.n);
  }
});

test("disordered: guess rejected when not playing and when not a permutation", () => {
  const { room, host, p2 } = setup();
  const g = room.game;

  // phase is setup -> rejected
  p2.fire("disordered:guess", { order: g.palette });
  assert.strictEqual(g.players["s2"].attempts, 0);

  host.fire("disordered:start", { n: 5 });
  // not a permutation (wrong length / bogus)
  p2.fire("disordered:guess", { order: ["🐙"] });
  assert.strictEqual(g.players["s2"].attempts, 0);
  assert.strictEqual(p2.emitted.filter((e) => e.event === "disordered:feedback").length, 0);
});

test("disordered: valid wrong guess increments attempts, feedback solved=false", () => {
  const { room, host, p2 } = setup();
  const g = room.game;
  host.fire("disordered:start", { n: 5 });

  const secret = room.private.secret;
  // Build a wrong permutation: rotate the secret so at most some positions match.
  const wrong = [...secret.slice(1), secret[0]];
  // ensure it's actually wrong (n>=4 so rotation is never identity)
  p2.fire("disordered:guess", { order: wrong });

  assert.strictEqual(g.players["s2"].attempts, 1);
  const fb = p2.emitted.filter((e) => e.event === "disordered:feedback");
  assert.strictEqual(fb.length, 1);
  assert.ok(fb[0].payload.correct < g.n);
  assert.strictEqual(fb[0].payload.solved, false);
});

test("disordered: winning guess solves and emits disordered:solved", () => {
  const { room, io, host, p2 } = setup();
  const g = room.game;
  host.fire("disordered:start", { n: 5 });

  const secret = room.private.secret;
  p2.fire("disordered:guess", { order: [...secret] });

  const fb = p2.emitted.filter((e) => e.event === "disordered:feedback");
  assert.strictEqual(fb.length, 1);
  assert.strictEqual(fb[0].payload.solved, true);
  assert.strictEqual(fb[0].payload.correct, g.n);
  assert.ok(g.players["s2"].solvedAt);
  assert.strictEqual(io.eventsNamed("disordered:solved").length, 1);
});

test("disordered: reveal by host sets phase and answer", () => {
  const { room, host } = setup();
  const g = room.game;
  host.fire("disordered:start", { n: 5 });
  host.fire("disordered:reveal");
  assert.strictEqual(g.phase, "revealed");
  assert.deepStrictEqual(g.answer, room.private.secret);
});

test("disordered: onLeave deletes leaver and reassigns host", () => {
  const { room, io } = setup();
  const g = room.game;
  assert.strictEqual(g.hostId, "s1");

  disconnect(disordered, room, io, "s1");
  assert.ok(!("s1" in g.players));
  assert.strictEqual(g.hostId, "s2");
});
