# Deploying to Vercel

## One-time setup (takes ~5 minutes)

### 1. Push to GitHub
Create a new GitHub repo and push the contents of this `vercel-deploy/` folder as the root.

### 2. Import to Vercel
Go to vercel.com → New Project → Import your GitHub repo.

### 3. Add Storage (required for courses to work)

**KV (for course data):**
- Vercel Dashboard → Storage → Create → KV
- Name it anything (e.g. `portfolio-kv`)
- Connect it to your project — Vercel auto-adds the env vars

**Blob (for file uploads):**
- Vercel Dashboard → Storage → Create → Blob Store
- Name it anything (e.g. `portfolio-blob`)
- Connect it — Vercel auto-adds `BLOB_READ_WRITE_TOKEN`

### 4. Set your admin password
- Vercel Dashboard → your project → Settings → Environment Variables
- Add: `ADMIN_PASSWORD` = your chosen password

### 5. Deploy
Push any change (or redeploy) — your site goes live at `yourproject.vercel.app`

---

## File upload limits
- **Thumbnails & attachments**: Up to ~4MB per file (Vercel function limit)
- **Videos**: Up to 500MB (Vercel Blob limit on free plan). Very large videos may timeout on the free plan — if so, upgrade to Vercel Pro or host videos on YouTube/Vimeo and paste the URL instead of uploading.

## Admin password
Default: `rithish@admin` — change it via the `ADMIN_PASSWORD` environment variable.
