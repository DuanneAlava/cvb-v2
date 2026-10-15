# CampusVoiceBox

A web-based campus suggestion and voting platform. Students post suggestions or "voice out"
concerns, upvote what matters to them, and filter by category.

**Start here -> [GUIDE.md](./GUIDE.md)** for the full walkthrough: what's built, how to run
it with Docker or by hand, how to check a change (lint, the shared-list check and the API
tests), how to run it for real, and how the website talks to the server.

Quick start (Docker, development):
```bash
docker compose up --build
```
Frontend: http://localhost:3000 · Backend: http://localhost:4000/api/health

For real use, `docker-compose.prod.yml` runs the built website behind nginx - see GUIDE.md,
section 3b.
