# Services

_Party Games · Outside services_

Party Games runs entirely self-contained. It does not connect to any external service.

## No outside dependencies

There is no:
- **Authentication provider** — players identify themselves with a plain display name; no accounts, no sign-in.
- **Database or cache** — all state is in the server process's memory. No calls to Postgres, MongoDB, Redis, or any hosted data store.
- **AI service** — prompts for Punchline are a bundled JSON file. The code comments note it as an "AI-generation seam" for future use, but no AI API is called today.
- **Payment processor** — the app is free with no billing logic.
- **Email or notification service** — there is no email, push notification, or SMS integration.
- **Analytics or error tracking** — no telemetry, no Sentry, no logging platform.
- **CDN or object storage** — no file uploads, no media assets beyond what is served with the Next.js build.

## What does run

All communication happens between two parts of the same deployment:

| Component | Role |
|---|---|
| **Next.js frontend** | Renders the UI in the browser |
| **Socket.IO server** (embedded in the Next.js backend) | Manages rooms, game state, and real-time events |

Both run in the same Node.js process. The Socket.IO client in the browser opens a WebSocket to the same host it was served from — there is no separate API server to configure or secure.

## Implications for deployment

Because everything is in-memory and single-process, the app can be deployed on any single Node.js host with no environment variables or secrets to configure. The trade-off is that a restart or a crash loses all active game state instantly, and horizontal scaling is not supported without adding a shared session store (the code mentions Redis as the path forward if that's ever needed).
