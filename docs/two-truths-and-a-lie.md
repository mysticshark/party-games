# Two Truths & a Lie

_Party Games · Features_

Two Truths & a Lie is a social deduction game. Every player privately submits three statements about themselves — two true, one false — and the rest of the room tries to guess which one is the lie. You score for fooling people; voters score for spotting the lie.

## Identity

Like Beopardy, players are keyed by their **lowercase display name**. Refreshing mid-game keeps your score.

## Phases

### 1. Collect
All players write and submit their three statements and mark which one is the lie. The server:
- Shuffles the three statements into a random order so the lie's position isn't predictable.
- Stores the statements and the lie index privately — **no one else can see them yet**.

Once every player has submitted, the game advances automatically to the guessing phase. The host can also force-start early as long as at least one submission exists and there are at least two members in the room.

### 2. Guess (one player featured at a time)
One player's statements are shown to the room. Everyone **except the featured player** votes on which statement they think is the lie. Once all eligible voters have voted, the reveal happens automatically. The host can force-reveal early.

### 3. Reveal
After voting closes:
- The lie is exposed.
- All votes are shown.
- **Correct voters** (those who picked the lie) each score **100 points**.
- The **featured player** scores **50 points × the number of people they fooled** (those who voted for a truth).

### 4. Next round
The host clicks to advance to the next player. This repeats until every player has been featured.

### 5. Game over
Once the last player's round is revealed and the host advances, the game ends. Scores are shown. The host can start a brand-new game, which clears all statements, votes, and scores and re-registers everyone for a fresh collection phase.

## Disconnections mid-game

- If the **host** leaves, the role is reassigned.
- If the **featured player** leaves during guessing, the round is revealed early with the votes so far.
- If all remaining eligible voters have voted (after someone leaves), the reveal is triggered automatically.
- If someone leaves during collection, the game may auto-start if the departure triggers the "all submitted" condition.

## Things to watch out for

- **Minimum 3 players.** The game requires at least 3 to be meaningful (the featured player can't vote on their own statements).
- **Statements are private until revealed.** Other players never see your statements ahead of time — they're stored in `room.private` and never sent in the public state broadcast.
- **Forcing early start skips non-submitters.** If the host forces the game to begin before everyone submits, players who didn't submit are excluded from being featured but still vote on others' rounds.
- **Resetting wipes everything.** Starting a new game clears all accumulated scores. There's no way to preserve a leaderboard across games.
