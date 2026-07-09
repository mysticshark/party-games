const { test } = require("node:test");
const assert = require("node:assert");
const beopardy = require("../server/games/beopardy/index");
const { createRoom, createIo, connect } = require("./helpers/harness");

// 2-player game: host is Alice (s1), and pickVerifier — which excludes the
// buzzer/selector — always resolves to the one remaining player, making the
// verifier deterministic.
function setup() {
  const room = createRoom("beopardy");
  const io = createIo();
  const alice = connect(beopardy, room, io, { id: "s1", name: "Alice" });
  const bob = connect(beopardy, room, io, { id: "s2", name: "Bob" });
  return { room, io, alice, bob };
}

// Find a non-DD, unused cell.
function findNonDDCell(room) {
  const dd = room.private.dd;
  const board = room.game.board;
  for (let cat = 0; cat < board.length; cat++) {
    for (let row = 0; row < board[cat].clues.length; row++) {
      if (!(dd.cat === cat && dd.row === row)) return { cat, row };
    }
  }
  throw new Error("no non-DD cell");
}

test("beopardy: init defaults", () => {
  const room = createRoom("beopardy");
  beopardy.init(room);
  const g = room.game;
  assert.strictEqual(g.phase, "setup");
  assert.deepStrictEqual(g.players, {});
  assert.ok(Array.isArray(g.packs));
  assert.ok(g.packs.some((p) => p.id === "trivia-classics"));
});

test("beopardy: non-host start ignored; host start builds board", () => {
  const { room, alice, bob } = setup();
  const g = room.game;

  bob.fire("beopardy:start", { packId: "trivia-classics" });
  assert.strictEqual(g.phase, "setup");

  alice.fire("beopardy:start", { packId: "trivia-classics" });
  assert.strictEqual(g.phase, "board");
  assert.strictEqual(g.board.length, 4);
  for (const c of g.board) {
    assert.strictEqual(c.clues.length, 4);
    for (const cl of c.clues) assert.strictEqual(cl.used, false);
  }
  assert.strictEqual(g.controlKey, "alice");
  assert.ok(room.private.dd && typeof room.private.dd.cat === "number");
});

test("beopardy: select a non-DD cell by controller opens the clue", () => {
  const { room, alice, bob } = setup();
  const g = room.game;
  alice.fire("beopardy:start", { packId: "trivia-classics" });
  const { cat, row } = findNonDDCell(room);

  // non-controller, non-host cannot select — but here bob is neither controller
  // nor host, so this should be ignored.
  bob.fire("beopardy:select", { cat, row });
  assert.strictEqual(g.phase, "board");

  // controller selects
  alice.fire("beopardy:select", { cat, row });
  assert.strictEqual(g.phase, "clue");
  assert.ok(g.active);
  assert.strictEqual(g.active.cat, cat);
  assert.strictEqual(g.active.row, row);

  // nonexistent cell ignored (back to a fresh board state)
  alice.fire("beopardy:select", { cat: 99, row: 99 });
  assert.strictEqual(g.phase, "clue"); // unchanged
});

test("beopardy: buzz assigns verifier and privately sends answerinfo", () => {
  const { room, io, alice, bob } = setup();
  const g = room.game;
  alice.fire("beopardy:start", { packId: "trivia-classics" });
  const { cat, row } = findNonDDCell(room);
  alice.fire("beopardy:select", { cat, row });
  io.emitted = [];

  bob.fire("beopardy:buzz");
  assert.strictEqual(g.buzzedKey, "bob");
  assert.strictEqual(g.verifierKey, "alice"); // the other player
  assert.strictEqual(g.phase, "judging");

  const info = io.eventsNamed("beopardy:answerinfo");
  assert.strictEqual(info.length, 1);
  assert.strictEqual(info[0].target, "s1"); // sent to Alice's socket id
});

test("beopardy: judge correct adds score, marks used, back to board", () => {
  const { room, io, alice, bob } = setup();
  const g = room.game;
  alice.fire("beopardy:start", { packId: "trivia-classics" });
  const { cat, row } = findNonDDCell(room);
  const value = g.board[cat].clues[row].value;
  alice.fire("beopardy:select", { cat, row });
  bob.fire("beopardy:buzz");
  io.emitted = [];

  // verifier is Alice
  alice.fire("beopardy:judge", { correct: true });
  assert.strictEqual(g.players.bob.score, value);
  assert.strictEqual(g.board[cat].clues[row].used, true);
  assert.strictEqual(io.eventsNamed("beopardy:verdict").length, 1);
  assert.strictEqual(g.phase, "board");
});

test("beopardy: judge wrong subtracts score and locks the answerer", () => {
  const { room, alice, bob } = setup();
  const g = room.game;
  alice.fire("beopardy:start", { packId: "trivia-classics" });
  const { cat, row } = findNonDDCell(room);
  const value = g.board[cat].clues[row].value;
  alice.fire("beopardy:select", { cat, row });
  bob.fire("beopardy:buzz");

  alice.fire("beopardy:judge", { correct: false });
  assert.strictEqual(g.players.bob.score, -value);
  assert.ok(g.lockedKeys.includes("bob"));
});

test("beopardy: daily double wager and judging", () => {
  const { room, alice, bob } = setup();
  const g = room.game;
  alice.fire("beopardy:start", { packId: "trivia-classics" });
  const { cat, row } = room.private.dd;

  alice.fire("beopardy:select", { cat, row });
  assert.strictEqual(g.phase, "dd_wager");

  // wager clamps: request a huge amount, capped to max(score, maxBoardValue)=800
  alice.fire("beopardy:wager", { amount: 100000 });
  assert.strictEqual(g.phase, "dd_judging");
  assert.strictEqual(g.wager, 800);
  assert.strictEqual(g.buzzedKey, "alice");

  // verifier judges correct -> apply wager to Alice's score
  const verifier = g.verifierKey === "alice" ? alice : bob;
  verifier.fire("beopardy:judge", { correct: true });
  assert.strictEqual(g.players.alice.score, 800);
});

test("beopardy: newGame resets to setup", () => {
  const { room, alice } = setup();
  const g = room.game;
  alice.fire("beopardy:start", { packId: "trivia-classics" });
  assert.strictEqual(g.phase, "board");

  alice.fire("beopardy:newGame");
  assert.strictEqual(g.phase, "setup");
  assert.strictEqual(g.board, null);
});
