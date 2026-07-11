# Data model

_Party Games · Data_

Party Games has no database. All state is held in memory on the server process for as long as the server runs. This chapter describes the shape of that state and the rules around what is — and isn't — visible to players.

## The Room

Every active game session is a **room** object, created in `server/rooms.js` and stored in a plain JavaScript `Map` keyed by room code. A room contains:

| Field | What it holds |
|---|---|
| `code` | The short uppercase string players use to identify the room |
| `gameId` | Which game is running (`"wheel"`, `"disordered"`, `"beopardy"`, `"two-truths"`, `"punchline"`) |
| `members` | A `Map` of socket ID → `{ id, name }` — the currently connected players |
| `game` | Game-specific **public** state — sent to all clients on every update |
| `private` | Game-specific **secret** state — **never** included in broadcasts |
| `createdAt` | Unix timestamp of room creation |

### Public vs. private state

This split is the most important data boundary in the app. Every time the room state changes, the server broadcasts a `room:state` event to all members — but it only includes `code`, `gameId`, a stripped member list (`id` and `name` only), and the `game` object. The `private` object is **never sent over the wire** except via targeted private emissions to specific sockets.

Examples of what stays private:
- **Beopardy:** the correct answer for each clue (sent only to the verifier's socket), Final wagers and answers until the host applies them.
- **Punchline:** which player wrote which answer, and all votes, until the results phase.
- **Two Truths & a Lie:** the lie index and all statements until their reveal round.
- **Disordered Order:** the secret emoji order (the server computes correct-position counts without revealing the order directly).

## Player identity

Each game uses one of two identity strategies:

- **Socket ID–keyed** (Disordered Order): player records are indexed by the socket's connection ID. A browser refresh creates a new socket and a new player record — progress is not preserved.
- **Name-keyed** (Beopardy, Punchline, Two Truths): player records are indexed by the player's display name (trimmed, lowercased). A refresh reconnects to the same record as long as the player uses the same name. The name is saved to `localStorage` under the key `party-games:name`.

## Per-game state shapes

### Random Picker (`game` object)
- `rotation` — current wheel rotation in degrees (carries over between spins so the wheel always moves forward)
- `spinning` — boolean lock while a spin is in progress
- `winner` — the winning member object after each spin, or `null`

### Disordered Order (`game` object)
- `phase` — `"setup"` | `"play"` | `"revealed"`
- `roundId` — increments each round (clients use this to detect a new round and reset their boards)
- `n` — number of emojis in the current puzzle (4–8)
- `palette` — the set of emojis in play (order is meaningless — it's the secret that's ordered)
- `answer` — `null` during play; exposed after reveal
- `players` — map of socket ID → `{ attempts, solved, solvedAt }`
- **Private:** `secret` — the hidden emoji order

### Beopardy (`game` object)
- `phase` — `"setup"` | `"board"` | `"clue"` | `"dd_wager"` | `"dd_clue"` | `"judging"` | `"final_wager"` | `"final_clue"` | `"final_judging"` | `"gameover"`
- `players` — map of name key → `{ name, score }`
- `packs` — list of available question pack metadata (for the setup screen)
- `board` — 2D grid of clue cells with used/active state
- `active` — the currently selected clue's `{ cat, row }` coordinates
- `controller` — name key of the player with board control
- `buzzer` — name key of the player who buzzed in
- `verifier` — name key of the current verifier
- `lockedKeys` — list of name keys locked out of the current buzz round
- `final` — Final Beopardy state (`category`, wagered list, answered list, marks)
- **Private:** `pack` (full pack data including all answers), Final answers and wagers until applied

### Two Truths & a Lie (`game` object)
- `phase` — `"collect"` | `"guess"` | `"reveal"` | `"gameover"`
- `players` — map of name key → `{ name, score }`
- `submitted` — list of name keys who have submitted statements
- `order` — shuffled list of name keys defining the feature order
- `featuredKey` — name key of the currently featured player
- `statements` — the featured player's three statements (public once their round starts)
- `voted` — list of name keys who have voted this round
- `reveal` — `{ lieIndex, choices, counts, fooled }` once revealed, else `null`
- **Private:** per-player statements and lie indices (until that player's reveal), all in-flight votes

### Punchline (`game` object)
- `phase` — `"lobby"` | `"write"` | `"vote"` | `"results"` | `"gameover"`
- `players` — map of name key → `{ name, score }`
- `round` — current round number
- `prompt` — the current prompt text
- `answered` — list of name keys who have submitted an answer
- `voted` — list of name keys who have voted
- `gallery` — anonymised answer list `[{ aid, text }]` shown during voting
- `reveals` — answer list with authorship, shown during results
- **Private:** answer text keyed by author, `authors` map (answer ID → name key), votes

## What leaves the app

Nothing is stored to disk, sent to a third-party service, or logged anywhere. All data exchange is between the Socket.IO server and connected browser clients, and all of it disappears when the server restarts or the last player leaves a room.

## Persistence limits

| Scenario | What happens |
|---|---|
| Player refreshes (name-keyed game) | Reconnects with same identity, score preserved |
| Player refreshes (socket-keyed game) | New identity, previous progress lost |
| Player closes tab / disconnects | Removed from room; room deleted if last player |
| Server restarts | All rooms and state permanently lost |
| Server scales to multiple instances | Rooms are not shared — not supported without Redis |
