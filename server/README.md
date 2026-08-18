# Photo API (Express + Postgres)

Stores compressed trivia-card photos in Postgres. The GitHub Pages frontend calls this API from the **Captured** category.

## Local

```bash
cp server/.env.example server/.env
createdb trivia_photos   # skip if it already exists
cd server && npm install && npm start
```

Open http://localhost:8787 (the API also serves the frontend locally). Default PIN is `changeme`.

Docker is optional if you do not want Homebrew Postgres: `docker compose -f server/docker-compose.yml up -d` and point `DATABASE_URL` at port **5433**.

## Railway

1. New project → add a **PostgreSQL** plugin.
2. Deploy this `server/` folder (set the service root to `server`).
3. Set `DATABASE_URL`, `UPLOAD_PIN`, `ALLOWED_ORIGINS` (`https://dsdev901.github.io`), and optionally `ANTHROPIC_API_KEY` so photo parsing uses a vision model instead of OCR.
4. Leave `SERVE_FRONTEND` unset (production does not serve the trivia site).
5. In the live app, open Captured → **Add or remove cards** and enter the PIN to upload.

Anyone can view and search questions. Upload, edit, and delete still require `UPLOAD_PIN`. Photos stay hidden until **Show photo**. Images are JPEG-compressed (max 1600px) in Postgres.

`GET`/`POST /api/hits` is the shared home-page visitor tally (starts at 901). No PIN. The same IP is counted at most once every 30 minutes.
