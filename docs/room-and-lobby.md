# Room & lobby

_Party Games · Features_

The room and lobby layer is the foundation every game is built on. It handles how players discover and enter rooms, choose their display names, and share access with others.

## Starting a room

From the home page, clicking a game card immediately generates a fresh room code and navigates the browser to `/room/[code]?game=[gameId]`. Only games marked **live** are clickable; "coming soon" cards are greyed out and disabled.

The room is not actually created on the server until the first player opens that URL and enters a name — there is no pre-reservation step.

## Joining an existing room

Anyone who already has a room code can type it into the "Got a room code?" field on the home page and press **Join**. The code is normalised to uppercase and must be at least 3 characters. They can also go directly to the room URL, or click a shared link (see below).

## Entering a display name

When a player first visits a room URL, they are shown a name entry form before they can join. Their chosen name is:
- Validated (must be non-empty).
- Saved to `localStorage` so it's pre-filled on their next visit.
- Sent to the server as part of the `room:join` event.

If the browser already has a saved name from a previous session, the form is skipped and the player connects automatically.

## Connecting to the room

As soon as a name is available, the app opens a Socket.IO connection and emits a `room:join` event. The server:
1. Normalises the room code.
2. Finds or creates the room (creating it with the requested game if it's new).
3. Registers the player as a member.
4. Subscribes the player's socket to the room's channel.
5. Registers that game's event handlers.
6. Broadcasts the updated room state to everyone in the room.

If the room code is not found (e.g. the server restarted), the player receives a `room:error` message shown on screen.

## The host role

The first player to successfully join a room is the **host**. The host gets extra controls in every game (start rounds, force-advance, reveal answers, end the game). If the host disconnects, the next remaining player is automatically promoted.

## Renaming yourself

Players can change their display name mid-session. The new name is saved and broadcast to everyone in the room immediately. In games where identity is name-keyed (Beopardy, Punchline, Two Truths), renaming mid-game may disconnect your score from your new name — it's best done before a game starts.

## Sharing the room link

A **Share / room code button** in the room header copies the full room URL to the clipboard. A "Copied!" label appears briefly (≈1.5 seconds) as confirmation. The confirmation resets on a timer — the app does not verify whether the clipboard write actually succeeded.

## When players leave

When a player's connection drops or they navigate away:
- They are removed from the room's member list.
- The server notifies the active game so it can adapt (reassign host, re-open buzzers, auto-advance phases, etc.).
- Everyone remaining gets an updated room state.
- If the room becomes completely empty, it is **deleted from memory** and cannot be recovered.

## Important caveats

- **Rooms are not persisted.** A server restart wipes all active rooms. There is no way to reconnect to a room that no longer exists on the server.
- **Single-server only.** The in-memory store (`server/rooms.js`) only works on one process. The code notes that Redis would be needed to support multiple replicas.
