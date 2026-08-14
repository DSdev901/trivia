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
3. Set `DATABASE_URL` (Railway usually injects it), `UPLOAD_PIN`, and `ALLOWED_ORIGINS` to include `https://dsdev901.github.io`.
4. Leave `SERVE_FRONTEND` unset (production does not serve the trivia site).
5. In the live app, open Captured → **API connection** and paste the Railway URL plus PIN.

Or put the Railway URL in `data/api.json` as `"baseUrl"` so Pages has a default.

Photos are JPEG-compressed (max 1600px) and stored as `BYTEA` with a thumbnail. Viewing the list and images is public. Upload, edit, and delete still require `UPLOAD_PIN`. OCR is not wired yet; `extracted_text` is reserved.
