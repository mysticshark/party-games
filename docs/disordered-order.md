# Disordered Order

_Party Games · Features_

Disordered Order is an emoji Mastermind game. The server hides a secret arrangement of emojis; every player sees the same set of emojis but must figure out the correct order through a series of guesses. After each guess, the only feedback is **how many emojis are in exactly the right position** — no information about which ones are correct.

## Setup

Before starting, the host picks a **puzzle size** — between 4 and 8 emojis. The default is 5. The emojis are drawn from a fixed palette of 28 visually distinct options (`server/games/disordered.js`), and a fresh random subset is chosen for each round.

## A round in steps

1. **Host clicks Start Round.** The server picks a random subset of emojis, shuffles them into a secret order, and broadcasts the palette (the set of emojis, unordered) to all players. Everyone's board is reset.
2. **Players arrange their board.** Each player sees a row of emoji slots and rearranges them using:
   - **Tap to select and swap** — tap a slot to select it (highlighted), then tap another to swap them. Tap the same slot again to deselect.
   - **Drag to swap** — press and hold, then drag to another slot. A ghost emoji follows the pointer; the target slot highlights on hover. Release to swap.
   - **Lock a slot** — tap the lock button on any slot to freeze it in place. Locked slots are skipped by swaps and drags, useful when you're confident about a position.
3. **Player submits a guess.** Tapping **Submit Guess** sends the current arrangement to the server, which counts the number of correct positions and replies privately. The guess and its score are added to that player's history (visible only to them).
4. **Feedback loop.** Players keep rearranging and submitting until they crack the order (all positions correct) or the host reveals the answer.
5. **Someone solves it.** The moment a player submits the correct order, they are marked as solved. Everyone else sees a toast — "[Name] cracked it!" — that auto-dismisses after 2.5 seconds. A fanfare sound plays for the solver.
6. **Host reveals the answer.** The host can end the round at any time by clicking **Reveal Answer**, which exposes the secret order to all players and switches the game to the revealed phase.
7. **Start the next round.** The host can kick off another round (same or different size) whenever the group is ready.

## Game mode

The current mode is **race** — every player shares the same single secret and works on their own independent board. The code has a seam for adding co-op and solo-secret modes later, but only race is implemented.

## Things to watch out for

- **Guess feedback is private.** Only the submitting player sees their own guess history. There's no shared guess log.
- **The countdown is display-only.** During the Final phase of other games this doesn't apply here, but within Disordered Order, there is no time pressure enforced by the server — the host decides when to reveal.
- **Solve toasts disappear after 2.5 seconds** with no replay mechanism.
- **Minimum puzzle size is 4, maximum is 8.** Values outside that range are clamped automatically.
