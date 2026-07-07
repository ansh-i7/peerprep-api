# PeerPrep API

Backend REST API for [PeerPrep](https://peer-prep-five.vercel.app) — a study partner matching platform. Handles subject/availability-based matching and chat message storage/retrieval for the [PeerPrep frontend](<frontend-repo-url>).

**Live API:** https://peerprep-api-kpe9.onrender.com
**Frontend repo:** https://github.com/ansh-i7/PeerPrep

---

## What This Service Does

- Finds a study partner match for a user based on matching subject and overlapping availability
- Stores and retrieves chat messages for matched pairs

Authentication and profile creation are handled directly between the frontend and Supabase — they don't go through this API. This service is scoped specifically to matching and messaging logic.

---

## Tech Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL (via Supabase, accessed with the Supabase service client)
- Hosted on Render

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check — confirms the service is running |
| GET | `/match/:userId` | Finds an existing match or creates a new one based on subject + overlapping time slot |
| POST | `/messages` | Sends a message. Body: `{ match_id, sender_id, content }` |
| GET | `/messages/:matchId?since=<timestamp>` | Returns messages for a match, optionally filtered to those created after a given timestamp |

### Example requests

```bash
# Health check
curl https://peerprep-api-kpe9.onrender.com/health

# Find/create a match
curl https://peerprep-api-kpe9.onrender.com/match/<userId>

# Send a message
curl -X POST https://peerprep-api-kpe9.onrender.com/messages \
  -H "Content-Type: application/json" \
  -d '{"match_id":"<matchId>","sender_id":"<userId>","content":"hey, ready to study?"}'

# Poll for new messages
curl "https://peerprep-api-kpe9.onrender.com/messages/<matchId>?since=2026-07-06T00:00:00Z"
```

---

## Why Polling, Not WebSockets

Chat updates are delivered via polling — the frontend calls `GET /messages/:matchId?since=<timestamp>` every few seconds — rather than Socket.io/WebSockets. This was a deliberate v1 scope decision to avoid the added complexity of persistent connections, reconnection handling, and websocket-specific hosting configuration on a tight build timeline. The matching and messaging logic already lives on this server, so migrating to Socket.io later is a contained change — no architectural rework needed.

---

## Running Locally

```bash
git clone <this-repo-url>
cd peerprep-api
npm install
```

Create a `.env` file:
```
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
```

**Note:** use your Supabase **secret key** here, not the publishable/anon key — this server needs elevated access to query across all users' profiles for matching. Never commit `.env` or expose this key in frontend code.

```bash
npm run dev
```

Server runs on `http://localhost:4000` by default.

### Build for production
```bash
npm run build
npm start
```

---

## Database Schema

This API reads/writes to the following Supabase tables (schema defined and managed on the frontend repo — see [PeerPrep frontend README](<frontend-repo-url>) for full details):

```sql
create table profiles (
  id uuid references auth.users primary key,
  display_name text not null,
  subject text not null,
  available_from time not null,
  available_to time not null,
  created_at timestamp default now()
);

create table matches (
  id uuid default gen_random_uuid() primary key,
  user_a uuid references auth.users not null,
  user_b uuid references auth.users not null,
  subject text not null,
  created_at timestamp default now()
);

create table messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches not null,
  sender_id uuid references auth.users not null,
  content text not null,
  created_at timestamp default now()
);
```

---

## Deployment Notes

Deployed on Render's free tier, which spins down after periods of inactivity. The first request after idle time may take 20-30 seconds while the instance wakes up — subsequent requests respond normally.

**Environment variables required on Render:**
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `PORT` (Render sets this automatically, but the app falls back to `4000` if unset)

---

## Future Scope

- Migrate chat delivery from polling to Socket.io for true real-time messaging
- Add Gemini API-powered matching to go beyond simple rule-based subject/time overlap
- Support group study sessions (3+ participants)
- Add rate limiting and input sanitization hardening for production use