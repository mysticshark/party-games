# Overview

_Party Games · Overview_

Party Games is a browser-based multiplayer party game platform. Players open a link, pick a display name, and immediately start playing with friends — no accounts, no downloads, no setup. Everything happens in real time over a persistent WebSocket connection.

## What's in the box

The app ships **five live games** today, with one more ("Buzzword Bingo") listed as coming soon:

| Game | Description | Min players |
|---|---|---|
| 🎡 **Random Picker** | Spin a shared wheel to pick who goes next | 2 |
| 🔀 **Disordered Order** | Emoji Mastermind — crack the hidden order | 1 |
| 🧠 **Beopardy** | Buzz-in trivia with Daily Doubles and a Final round | 2 |
| 🕵️ **Two Truths & a Lie** | Submit three statements, the room guesses the lie | 3 |
| 🎤 **Punchline** | Write funny answers to a prompt, the room votes | 3 |

## How the app is organized

There are only **two pages** in the entire app:

- **Home (`/`)** — browse available games, start a new room, or join one with a code.
- **Room (`/room/[code]`)** — everything else. The same page renders whichever game is active in that room.

Behind the scenes, a **Node.js server** (running inside the Next.js backend) manages rooms and game state entirely in memory. Every interaction — joining a room, buzzing in, submitting an answer — travels over a Socket.IO WebSocket connection. There is no database; rooms live only as long as the server process is running.

## Key concepts to keep in mind

- **Rooms** are ephemeral. If the server restarts, all active rooms and their state are gone.
- **The host** is the first person to enter a room. Most "move the game forward" controls (start round, force-reveal, apply scores) are host-only.
- **Identity is name-based**, not session-based. Your display name is saved in your browser's `localStorage` and re-used next time. In some games (Beopardy, Punchline, Two Truths) your name is your identity key, so refreshing the browser mid-game lets you reconnect and keep your score.
- **No outside services.** The app runs entirely self-contained — no logins, no cloud database, no payment processor, no analytics.

## How to read this manual

- **Features** — one chapter per game (plus a shared chapter for rooms and the lobby). Each chapter explains what users see and do, step by step.
- **Data model** — where state lives, what's public vs. secret, and what leaves the browser.
- **Services** — a short note confirming the app has no external service dependencies.
