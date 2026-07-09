const { test } = require("node:test");
const assert = require("node:assert");
const wheel = require("../server/games/wheel");
const { createRoom, createIo, connect, stubRandom } = require("./helpers/harness");

test("wheel: init sets defaults", () => {
  const room = createRoom("wheel");
  wheel.init(room);
  assert.strictEqual(room.game.rotation, 0);
  assert.strictEqual(room.game.spinning, false);
  assert.strictEqual(room.game.winner, null);
});

test("wheel: spin with fewer than 2 members does nothing", () => {
  const room = createRoom("wheel");
  const io = createIo();
  const s = connect(wheel, room, io, { id: "s1", name: "Alice" });
  io.emitted = [];
  s.fire("wheel:spin");
  assert.strictEqual(io.emitted.length, 0);
  assert.strictEqual(room.game.spinning, false);
});

test("wheel: spin with 2+ members emits wheel:spin (random 0 => winnerIndex 0)", (t) => {
  stubRandom([0]);
  const room = createRoom("wheel");
  const io = createIo();
  const s1 = connect(wheel, room, io, { id: "s1", name: "Alice" });
  connect(wheel, room, io, { id: "s2", name: "Bob" });
  const prev = room.game.rotation;
  io.emitted = [];

  s1.fire("wheel:spin");

  const spins = io.eventsNamed("wheel:spin");
  assert.strictEqual(spins.length, 1);
  const p = spins[0].payload;
  assert.ok("rotation" in p && "winnerIndex" in p && "winner" in p && "duration" in p);
  assert.strictEqual(p.winnerIndex, 0);
  assert.ok(p.winnerIndex >= 0 && p.winnerIndex < room.members.size);
  assert.ok(p.rotation >= prev);
  assert.ok(p.rotation - prev >= 360 * 5);

  assert.strictEqual(room.game.spinning, true);
  assert.strictEqual(room.game.winner, null);
});

test("wheel: after the delay, spinning resolves and results emit", (t) => {
  stubRandom([0]);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const room = createRoom("wheel");
  const io = createIo();
  const s1 = connect(wheel, room, io, { id: "s1", name: "Alice" });
  connect(wheel, room, io, { id: "s2", name: "Bob" });
  io.emitted = [];

  s1.fire("wheel:spin");
  assert.strictEqual(room.game.spinning, true);

  t.mock.timers.tick(4650);

  assert.strictEqual(room.game.spinning, false);
  assert.ok(room.game.winner);
  assert.strictEqual(io.eventsNamed("wheel:result").length, 1);
  assert.ok(io.eventsNamed("room:state").length >= 1);
});
