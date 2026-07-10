const KEY_POOL = [
  'A','B','C','D','E','F','G','H','J','K','L','M',
  'N','P','Q','R','S','T','U','V','W','X','Y','Z',
  '2','3','4','5','6','7','8','9',
];
// I, O removed (look like 1/0); 0 and 1 removed (look like O/I/l)

const COUNTDOWN_MS = 3000;
const ROUND_TIMEOUT_MS = 30000;
const MIN_KEYS = 1;
const MAX_KEYS = 8;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickKeys(count) {
  return shuffle(KEY_POOL).slice(0, count);
}

function init(room) {
  const g = room.game;
  if (!g.phase) g.phase = 'lobby';
  if (typeof g.round !== 'number') g.round = 0;
  if (typeof g.keyCount !== 'number') g.keyCount = 1;
  if (!g.sequence) g.sequence = [];
  if (g.startedAt === undefined) g.startedAt = null;
  if (!g.results) g.results = [];
  if (g.hostId === undefined) g.hostId = null;
  if (!g.players) g.players = {};
}

function startRound(room, broadcastState) {
  const g = room.game;

  if (room._roundTimer) {
    clearTimeout(room._roundTimer);
    room._roundTimer = null;
  }

  g.sequence = pickKeys(g.keyCount);
  g.startedAt = Date.now() + COUNTDOWN_MS;
  g.phase = 'playing';
  g.results = [];

  for (const p of Object.values(g.players)) {
    p.done = false;
  }

  broadcastState();

  room._roundTimer = setTimeout(() => {
    if (g.phase === 'playing') {
      g.phase = 'results';
      broadcastState();
    }
  }, ROUND_TIMEOUT_MS + COUNTDOWN_MS);
}

function allMembersDone(room) {
  return [...room.members.keys()].every((id) => room.game.players[id]?.done);
}

function register(io, socket, { room, broadcastState }) {
  const g = room.game;

  if (!g.hostId || !room.members.has(g.hostId)) g.hostId = socket.id;

  const member = room.members.get(socket.id);
  g.players[socket.id] = g.players[socket.id] || { name: member?.name || 'Guest', done: false };

  const isHost = () => socket.id === g.hostId;

  socket.on('km:start', ({ keyCount } = {}) => {
    if (!isHost() || g.phase !== 'lobby') return;
    const clamped = Math.max(MIN_KEYS, Math.min(MAX_KEYS, parseInt(keyCount, 10) || 1));
    g.keyCount = clamped;
    g.round = 1;
    startRound(room, broadcastState);
  });

  socket.on('km:done', ({ typed } = {}) => {
    if (g.phase !== 'playing') return;
    if (Date.now() < g.startedAt) return;
    const player = g.players[socket.id];
    if (!player || player.done) return;
    if (
      !Array.isArray(typed) ||
      typed.length !== g.sequence.length ||
      !typed.every((k, i) => k === g.sequence[i])
    ) return;

    player.done = true;
    const ms = Date.now() - g.startedAt;
    g.results.push({ id: socket.id, name: room.members.get(socket.id)?.name || 'Guest', ms });
    broadcastState();

    if (allMembersDone(room)) {
      if (room._roundTimer) {
        clearTimeout(room._roundTimer);
        room._roundTimer = null;
      }
      g.phase = 'results';
      broadcastState();
    }
  });

  socket.on('km:next', ({ increaseKeys } = {}) => {
    if (!isHost() || g.phase !== 'results') return;
    if (increaseKeys === true) {
      g.keyCount = Math.min(MAX_KEYS, g.keyCount + 1);
    }
    g.round += 1;
    startRound(room, broadcastState);
  });

  socket.on('km:restart', () => {
    if (!isHost()) return;
    if (room._roundTimer) {
      clearTimeout(room._roundTimer);
      room._roundTimer = null;
    }
    g.phase = 'lobby';
    g.round = 0;
    g.keyCount = 1;
    g.sequence = [];
    g.startedAt = null;
    g.results = [];
    for (const p of Object.values(g.players)) p.done = false;
    broadcastState();
  });
}

function onLeave(room, socketId) {
  const g = room.game;
  if (g.players) delete g.players[socketId];

  if (g.hostId === socketId) {
    const next = room.members.keys().next();
    g.hostId = next.done ? null : next.value;
  }

  if (g.phase === 'playing' && allMembersDone(room)) {
    if (room._roundTimer) {
      clearTimeout(room._roundTimer);
      room._roundTimer = null;
    }
    g.phase = 'results';
  }
}

module.exports = { id: 'keymaster', init, register, onLeave };
