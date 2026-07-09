const { test } = require("node:test");
const assert = require("node:assert");
const tt = require("../server/games/twotruths");
const { createRoom, createIo, connect, disconnect } = require("./helpers/harness");

function nameKey(name) {
  return String(name || "").trim().toLowerCase();
}

const STMTS = ["truth one", "truth two", "the lie"];

test("twotruths: init defaults", () => {
  const room = createRoom("two-truths");
  tt.init(room);
  const g = room.game;
  assert.strictEqual(g.phase, "collect");
  assert.deepStrictEqual(g.players, {});
  assert.deepStrictEqual(g.submitted, []);
  assert.deepStrictEqual(room.private.statements, {});
  assert.deepStrictEqual(room.private.lies, {});
});

test("twotruths: submit validation", () => {
  const room = createRoom("two-truths");
  const io = createIo();
  const a = connect(tt, room, io, { id: "s1", name: "Alice" });
  const g = room.game;

  // wrong length
  a.fire("tt:submit", { statements: ["a", "b"], lieIndex: 0 });
  assert.ok(!("alice" in g.submitted.reduce((o, k) => ((o[k] = 1), o), {})));
  assert.strictEqual(g.submitted.length, 0);

  // empty string
  a.fire("tt:submit", { statements: ["a", "", "c"], lieIndex: 0 });
  assert.strictEqual(g.submitted.length, 0);

  // out-of-range lieIndex
  a.fire("tt:submit", { statements: ["a", "b", "c"], lieIndex: 5 });
  assert.strictEqual(g.submitted.length, 0);

  // success
  a.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  assert.ok(g.submitted.includes("alice"));
  assert.ok(room.private.statements.alice);
  assert.ok("alice" in room.private.lies);

  // duplicate ignored
  a.fire("tt:submit", { statements: ["x", "y", "z"], lieIndex: 0 });
  assert.strictEqual(g.submitted.filter((k) => k === "alice").length, 1);
});

test("twotruths: auto-begin when both submitted", () => {
  const room = createRoom("two-truths");
  const io = createIo();
  const a = connect(tt, room, io, { id: "s1", name: "Alice" });
  const b = connect(tt, room, io, { id: "s2", name: "Bob" });
  const g = room.game;

  a.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  assert.strictEqual(g.phase, "collect");
  b.fire("tt:submit", { statements: STMTS, lieIndex: 2 });

  assert.strictEqual(g.phase, "guess");
  assert.ok(Array.isArray(g.order));
  assert.ok(g.featuredKey);
});

test("twotruths: vote validation and reveal when all voted", () => {
  const room = createRoom("two-truths");
  const io = createIo();
  const a = connect(tt, room, io, { id: "s1", name: "Alice" });
  const b = connect(tt, room, io, { id: "s2", name: "Bob" });
  const g = room.game;
  a.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  b.fire("tt:submit", { statements: STMTS, lieIndex: 2 });

  const featured = g.featuredKey;
  const featuredSocket = featured === "alice" ? a : b;
  const voterSocket = featured === "alice" ? b : a;

  // featured player's vote is rejected
  featuredSocket.fire("tt:vote", { choice: 0 });
  assert.strictEqual(g.voted.length, 0);

  // invalid choice rejected
  voterSocket.fire("tt:vote", { choice: 9 });
  assert.strictEqual(g.voted.length, 0);

  // valid vote recorded -> triggers reveal (only 1 eligible voter)
  voterSocket.fire("tt:vote", { choice: 0 });
  assert.strictEqual(g.phase, "reveal");
});

test("twotruths: scoring — real lie +100, featured +50 per fooled", () => {
  const room = createRoom("two-truths");
  const io = createIo();
  const a = connect(tt, room, io, { id: "s1", name: "Alice" });
  const b = connect(tt, room, io, { id: "s2", name: "Bob" });
  const c = connect(tt, room, io, { id: "s3", name: "Carol" });
  const g = room.game;
  a.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  b.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  c.fire("tt:submit", { statements: STMTS, lieIndex: 2 });

  assert.strictEqual(g.phase, "guess");
  const featured = g.featuredKey;
  const lieIndex = room.private.lies[featured];
  const wrongIndex = (lieIndex + 1) % 3;

  const socketByKey = { alice: a, bob: b, carol: c };
  const voters = Object.keys(socketByKey).filter((k) => k !== featured);
  // voter[0] picks the real lie (+100), voter[1] picks wrong (fools featured)
  socketByKey[voters[0]].fire("tt:vote", { choice: lieIndex });
  socketByKey[voters[1]].fire("tt:vote", { choice: wrongIndex });

  assert.strictEqual(g.phase, "reveal");
  assert.strictEqual(g.players[voters[0]].score, 100);
  assert.strictEqual(g.players[voters[1]].score, 0);
  assert.strictEqual(g.players[featured].score, 50); // 1 fooled voter
});

test("twotruths: next advances rounds and ends at gameover", () => {
  const room = createRoom("two-truths");
  const io = createIo();
  const a = connect(tt, room, io, { id: "s1", name: "Alice" });
  const b = connect(tt, room, io, { id: "s2", name: "Bob" });
  const g = room.game;
  a.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  b.fire("tt:submit", { statements: STMTS, lieIndex: 2 });

  const host = g.hostId === "s1" ? a : b;

  // round 0 -> vote to reveal
  {
    const featured = g.featuredKey;
    const voter = featured === "alice" ? b : a;
    voter.fire("tt:vote", { choice: 0 });
  }
  assert.strictEqual(g.phase, "reveal");

  host.fire("tt:next"); // advance to round 1 (order length 2)
  assert.strictEqual(g.phase, "guess");
  assert.strictEqual(g.roundIdx, 1);

  {
    const featured = g.featuredKey;
    const voter = featured === "alice" ? b : a;
    voter.fire("tt:vote", { choice: 0 });
  }
  assert.strictEqual(g.phase, "reveal");

  host.fire("tt:next"); // order exhausted -> gameover
  assert.strictEqual(g.phase, "gameover");
});

test("twotruths: onLeave during guess with featured leaving triggers reveal", () => {
  const room = createRoom("two-truths");
  const io = createIo();
  const a = connect(tt, room, io, { id: "s1", name: "Alice" });
  const b = connect(tt, room, io, { id: "s2", name: "Bob" });
  const c = connect(tt, room, io, { id: "s3", name: "Carol" });
  const g = room.game;
  a.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  b.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  c.fire("tt:submit", { statements: STMTS, lieIndex: 2 });
  assert.strictEqual(g.phase, "guess");

  const featured = g.featuredKey;
  const socketIdByKey = { alice: "s1", bob: "s2", carol: "s3" };
  disconnect(tt, room, io, socketIdByKey[featured]);

  assert.strictEqual(g.phase, "reveal");
});
