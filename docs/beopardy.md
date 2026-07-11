# Beopardy

_Party Games · Features_

Beopardy is a Jeopardy-style buzz-in trivia game. Players answer clues from a category board, wager on Daily Doubles, and finish with a Final Beopardy round where everyone bets their score. The game is deliberately designed so **no single player ever sees the answer before judging** — a randomly chosen verifier receives each answer privately and rules on it.

## Roles

- **Host** — the first player to join the room. The host also plays as a regular contestant. The host has extra controls (start game, skip to Final, force-advance).
- **Controller** — the player whose turn it is to pick a clue from the board. Control passes after each clue resolves.
- **Verifier** — a randomly chosen player (not the buzzer) who receives the correct answer privately and judges the response. The verifier is locked out of buzzing on that clue. The same verifier is reused if buzzing re-opens, so only one person per clue sees the answer early.

## Identity and reconnection

Players are identified by their **lowercase display name**, not their socket connection. This means that if you refresh the browser mid-game, your score is preserved and the server re-sends you the answer if you were the current verifier.

## Phases of a game

### 1. Setup
The host selects a **question pack** to load. The pack determines the categories, clues, and values on the board.

### 2. Board
A grid of categories and dollar values is shown. One cell is randomly designated the **Daily Double** (hidden until selected).

- The **controller** (or the host) clicks a cell to select a clue.
- **Normal clue:** the buzzer opens for all players. The first to press **Buzz** wins the right to answer.
- **Daily Double:** only the controller wagers. The rest of the board is hidden during wagering.

### 3. Buzzing and judging
1. The first player to buzz is recorded. A random other player becomes the verifier and privately receives the answer.
2. The verifier sees the answer blurred by default; clicking **Reveal answer** unblurs it.
3. The verifier clicks **Correct** or **Wrong**.
   - **Correct:** the buzzer earns the clue's value (or their wager on a Daily Double). The clue is resolved.
   - **Wrong:** the buzzer loses the clue's value. On a normal clue, buzzing re-opens for remaining players. On a Daily Double, the clue is resolved immediately.
4. If no one buzzes (or the controller/host clicks **No takers — reveal answer**), the clue is skipped and the answer is revealed.

### 4. Daily Double wager
When a Daily Double cell is selected:
- The controller enters a wager. The minimum is $100; the maximum is the greater of their current score or the highest value on the board.
- Clicking **True Daily Double — all in** automatically sends the maximum allowed wager.
- After wagering, the game moves to a judging phase just like a normal clue (except only the controller answers).

### 5. Final Beopardy
When all clues are played (or the host clicks **Skip to Final Beopardy**):

1. **Wager phase.** Every player privately enters a wager. Once all players have submitted, the clue is revealed automatically. The host can force-advance for stragglers.
2. **Answer phase.** Each player privately types their answer. A 60-second countdown is shown — but it is **display-only** and does not automatically end the phase. The host must click **Everyone's in — force continue** when ready.
3. **Judging phase.** All answers and wagers are revealed together. The host toggles each player's answer **Correct** or **Wrong**. Scores are not updated yet — this is a preview step.
4. **Apply scores.** The host clicks **Apply scores & finish**. Each player's wager is added (correct) or subtracted (wrong) from their score, and the game moves to the game-over screen.

### 6. Game over
Scores are shown. The host can click **Play again** to reset everything and return to the setup phase with the same group of players.

## Disconnections mid-game

The server handles mid-game dropouts gracefully:
- If the **host** leaves, the next player is promoted.
- If the **controller** leaves, control is reassigned.
- If the **verifier** leaves, a new verifier is picked.
- If the **buzzer** (the player currently answering) leaves, buzzing re-opens.
- If the **last missing player** in a Final round leaves, the phase auto-advances.

## Important caveats

- **The Final Beopardy countdown is visual only.** It reaches zero but nothing happens automatically — the host must manually continue.
- **The verifier sees the answer.** Choose verifiers you trust to judge fairly; the role is assigned randomly and they cannot opt out.
- **Question packs are bundled server-side.** There is no in-app editor for packs (`server/games/beopardy/packs`).
- **Scores can go negative.** Wrong answers on Daily Doubles or Final Beopardy with a large wager will push a score below zero.
