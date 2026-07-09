// Shared test harness for the server-side game modules.
//
// Game modules expose { id, init, register(io, socket, ctx), onLeave? } and
// drive behavior through socket event handlers. This mirrors the join /
// disconnect flow in server.js (using the REAL publicState from server/rooms.js)
// with in-memory fakes so tests run fully in-process — no network, no server.
const { mock } = require("node:test");
const { publicState } = require("../../server/rooms");

// Mirrors makeRoom() in server/rooms.js.
function createRoom(gameId) {
  return {
    code: "TEST",
    gameId,
    members: new Map(),
    game: {},
    private: {},
    createdAt: Date.now(),
  };
}

// Records every emit. io.to(target) is called with BOTH room codes (broadcasts)
// and socket ids (beopardy emitToKey private sends) — target is opaque here.
function createIo() {
  const io = {
    emitted: [],
    to(target) {
      return {
        emit: (event, payload) => {
          io.emitted.push({ target, event, payload });
        },
      };
    },
    eventsNamed(name) {
      return io.emitted.filter((e) => e.event === name);
    },
  };
  return io;
}

function createSocket(id) {
  return {
    id,
    handlers: {},
    emitted: [],
    on(event, fn) {
      this.handlers[event] = fn;
    },
    emit(event, payload) {
      this.emitted.push({ event, payload });
    },
    join() {},
    fire(event, payload) {
      return this.handlers[event]?.(payload);
    },
  };
}

// Mirrors the room:join flow in server.js.
function connect(game, room, io, { id, name }) {
  room.members.set(id, { id, name });
  if (game.init) game.init(room);
  const socket = createSocket(id);
  const broadcastState = () =>
    io.to(room.code).emit("room:state", publicState(room));
  if (game.register) game.register(io, socket, { room, broadcastState });
  return socket;
}

// Mirrors the disconnect flow in server.js.
function disconnect(game, room, io, socketId) {
  room.members.delete(socketId);
  if (room.members.size === 0) return;
  game.onLeave?.(room, socketId, io);
}

// Stub Math.random to return a fixed, cycling sequence for deterministic
// shuffles / winner picks. Returns the mock so callers can restore if needed.
function stubRandom(values) {
  let i = 0;
  return mock.method(Math, "random", () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  });
}

module.exports = {
  createRoom,
  createIo,
  createSocket,
  connect,
  disconnect,
  stubRandom,
  publicState,
};
