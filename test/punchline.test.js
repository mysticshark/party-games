const { test } = require("node:test");
const assert = require("node:assert");
const punchline = require("../server/games/punchline/index");
const { createRoom, createIo, connect } = require("./helpers/harness");

function setup(names = ["Alice", "Bob"]) {
  const room = createRoom("punchline");
  const io = createIo();
  const sockets = {};
  names.forEach((name, i) => {
    sockets[name] = connect(punchline, room, io, { id: `s${i + 1}`, name });
  });
  return { room, io, sockets };
}

test("punchline: init defaults", () => {
  const room = createRoom("punchline");
  punchline.init(room);
  const g = room.game;
  assert.strictEqual(g.phase, "lobby");
  assert.strictEqual(g.round, 0);
  assert.deepStrictEqual(room.private.usedPrompts, []);
});

test("punchline: host start from lobby -> write, round 1, prompt set", () => {
  const { room, sockets } = setup();
  const g = room.game;
  const host = sockets.Alice; // s1 is host

  sockets.Bob.fire("pl:start"); // non-host ignored
  assert.strictEqual(g.phase, "lobby");

  host.fire("pl:start");
  assert.strictEqual(g.phase, "write");
  assert.strictEqual(g.round, 1);
  assert.ok(typeof g.prompt === "string" && g.prompt.length > 0);
  assert.strictEqual(room.private.usedPrompts.length, 1);
});

test("punchline: answer validation and auto-advance to vote", () => {
  const { room, sockets } = setup();
  const g = room.game;
  sockets.Alice.fire("pl:start");

  // empty rejected
  sockets.Alice.fire("pl:answer", { text: "   " });
  assert.strictEqual(Object.keys(room.private.answers).length, 0);

  sockets.Alice.fire("pl:answer", { text: "Alice answer" });
  assert.ok("alice" in room.private.answers);

  // duplicate ignored
  sockets.Alice.fire("pl:answer", { text: "again" });
  assert.strictEqual(room.private.answers.alice, "Alice answer");

  assert.strictEqual(g.phase, "write"); // Bob hasn't answered yet
  sockets.Bob.fire("pl:answer", { text: "Bob answer" });

  assert.strictEqual(g.phase, "vote");
  assert.ok(Array.isArray(g.gallery));
  assert.strictEqual(g.gallery.length, 2);
  for (const item of g.gallery) {
    assert.ok(typeof item.aid === "string");
    assert.ok(typeof item.text === "string");
  }
});

test("punchline: vote validation, scoring and results", () => {
  const { room, sockets } = setup();
  const g = room.game;
  sockets.Alice.fire("pl:start");
  sockets.Alice.fire("pl:answer", { text: "Alice answer" });
  sockets.Bob.fire("pl:answer", { text: "Bob answer" });
  assert.strictEqual(g.phase, "vote");

  const aliceCard = g.gallery.find((c) => room.private.authors[c.aid] === "alice");
  const bobCard = g.gallery.find((c) => room.private.authors[c.aid] === "bob");

  // self-vote rejected
  sockets.Alice.fire("pl:vote", { aid: aliceCard.aid });
  assert.strictEqual(g.voted.length, 0);

  // unknown aid rejected
  sockets.Alice.fire("pl:vote", { aid: "nope" });
  assert.strictEqual(g.voted.length, 0);

  // valid votes: both vote for Bob's card
  sockets.Alice.fire("pl:vote", { aid: bobCard.aid });
  sockets.Bob.fire("pl:vote", { aid: aliceCard.aid });

  assert.strictEqual(g.phase, "results");
  assert.strictEqual(g.players.bob.score, 100); // 1 vote
  assert.strictEqual(g.players.alice.score, 100); // 1 vote
});

test("punchline: end from results -> gameover; newGame resets", () => {
  const { room, sockets } = setup();
  const g = room.game;
  sockets.Alice.fire("pl:start");
  sockets.Alice.fire("pl:answer", { text: "a" });
  sockets.Bob.fire("pl:answer", { text: "b" });
  const bobCard = g.gallery.find((c) => room.private.authors[c.aid] === "bob");
  const aliceCard = g.gallery.find((c) => room.private.authors[c.aid] === "alice");
  sockets.Alice.fire("pl:vote", { aid: bobCard.aid });
  sockets.Bob.fire("pl:vote", { aid: aliceCard.aid });
  assert.strictEqual(g.phase, "results");

  sockets.Alice.fire("pl:end");
  assert.strictEqual(g.phase, "gameover");

  sockets.Alice.fire("pl:newGame");
  assert.strictEqual(g.phase, "lobby");
  assert.strictEqual(g.round, 0);
  assert.deepStrictEqual(room.private.usedPrompts, []);
  assert.deepStrictEqual(room.private.answers, {});
});
