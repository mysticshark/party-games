# Random Picker

_Party Games · Features_

Random Picker is the simplest game in the collection. Everyone in the room becomes a slice of a shared spinning wheel, and a spin picks one player at random.

## What it's for

Use it whenever your group needs to decide who goes first, who answers a question, who picks the next song, or anything else where a fair random choice settles it.

## How it works

1. **Everyone joins the room.** Each connected member automatically appears as a segment on the wheel. The wheel updates live as people join or leave.
2. **Someone clicks Spin.** Any player can spin — there's no host-only restriction on this action. (The host is still the first person in, but spinning is open to all.)
3. **The server decides the winner.** The winning player is chosen server-side so that every client animates to the exact same final rotation. The wheel spins for about 4.5 seconds.
4. **The winner is announced.** After the animation completes, the winning player's name is highlighted and broadcast to the room.

## Things to know

- **Spinning is blocked while a spin is in progress.** If a spin is already underway, additional spin requests are ignored until the animation resolves (roughly 4.5 seconds + a small buffer).
- **Minimum 2 players.** Spinning does nothing if fewer than 2 members are in the room.
- **No score tracking.** Random Picker has no points, rounds, or game phases — it's a one-shot utility. You can spin as many times as you like.
- **No reset needed.** There's nothing to reset; just spin again.
