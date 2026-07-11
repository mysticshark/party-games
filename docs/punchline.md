# Punchline

_Party Games · Features_

Punchline is a Quiplash-style party game. Each round, everyone sees the same prompt and writes the funniest answer they can. Answers are shown anonymously and the room votes for their favourite. Votes become points.

## How a game plays out

### 1. Lobby
Players join and wait. The host can start Round 1 once enough players are present (minimum 3).

### 2. Write phase
A prompt is shown to all players. Everyone types their funniest answer into the text field and submits it (either by pressing Enter or clicking the submit button). Answers are stored privately on the server — **no one sees who wrote what during this phase**.

Once all players have submitted, the game automatically advances to voting. The host can force-advance if someone is slow to submit (provided at least two answers exist).

### 3. Vote phase
All submitted answers are shown anonymously in a random order. Each player votes for their favourite. Rules:
- **You cannot vote for your own answer.** Self-votes are rejected by the server.
- **You can only vote once.** Duplicate votes are blocked.

Once all players have voted, the game moves to results. The host can force-advance to skip stragglers.

### 4. Results
All answers are revealed with their authors and vote counts. Each vote a player received earns them **1 point**. A sound effect plays if you got any votes; a fanfare plays at game over.

### 5. Next round / game over
The host can start the next round (a fresh prompt, same players and scores) or end the game. Ending the game moves to a game-over screen. Starting a brand-new game resets all scores and the player roster.

## Prompts

Prompts come from a bundled JSON file (`server/games/punchline/prompts.json`). The server tracks which prompts have been used in a session and avoids repeats until all prompts are exhausted, then resets. The code notes the prompts file is intended as an AI-generation seam — future tooling could append AI-generated prompts without changing game logic.

## Disconnections mid-game

- If the **host** leaves, the role is reassigned to the next player.
- If someone leaves during the **write phase** and the remaining players have all submitted, the game auto-advances to voting.
- If someone leaves during the **vote phase** and the remaining players have all voted, the game auto-advances to results.

## Things to watch out for

- **Answers are anonymous during voting** — authorship is stored in `room.private` and is only revealed at results. Players have no way to know who wrote what while voting.
- **Sound effects are client-side only** and are lost on page refresh. If you reload in the middle of a results phase, you won't hear the fanfare.
- **Minimum 3 players** to start a game.
- **All input state is lost on refresh.** If you've typed an answer but haven't submitted and you refresh, you'll need to retype it.
