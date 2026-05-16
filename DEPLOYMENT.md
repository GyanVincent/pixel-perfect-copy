# Deployment Guide

This project is a **TanStack Start** app (React 19 + Vite 7). The AI features run in
server routes under `src/routes/api/*`, so they work on any host that supports
Node-style serverless functions or a Node server.

The frontend always calls AI through **relative URLs** (`/api/ai-chat`, `/api/ai-image`,
`/api/ai-mcq`), so there is no hard-coded localhost or Lovable URL anywhere in the
client bundle. As long as the server routes are deployed alongside the frontend,
the AI will work.

---

## 1. Set up environment variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — public, safe in the client
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — server only
- **One** of: `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `LOVABLE_API_KEY`

Where to insert your AI key:

| Provider | Where to get it                                  | Env var          |
| -------- | ------------------------------------------------ | ---------------- |
| OpenAI   | https://platform.openai.com/api-keys             | `OPENAI_API_KEY` |
| Gemini   | https://aistudio.google.com/app/apikey           | `GEMINI_API_KEY` |
| Lovable  | Auto-provided in Lovable Cloud sandboxes         | `LOVABLE_API_KEY`|

If no key is set, the API will respond `500` with a clear message:
`"No AI provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or LOVABLE_API_KEY in your environment."`

---

## 2. Vercel

1. Push to GitHub and import the repo at https://vercel.com/new
2. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`
3. **Settings → Environment Variables**: add every variable from `.env.example`
4. Deploy. Server routes deploy as Vercel serverless functions automatically.

---

## 3. Netlify

1. Push to GitHub and import the repo at https://app.netlify.com/start
2. Build command: `npm run build`. Publish directory: `dist`
3. **Site settings → Environment variables**: add every variable from `.env.example`
4. Deploy. TanStack Start emits a Netlify-compatible server bundle.

---

## 4. GitHub Pages (frontend only)

GitHub Pages serves **static files only** — it cannot run the `/api/*` server
routes. You have two options:

**Option A — host the backend elsewhere (recommended):**
1. Deploy the full app to Vercel/Netlify/Cloudflare as above. Note the URL,
   e.g. `https://my-api.vercel.app`.
2. Build the frontend for GitHub Pages with an explicit API base:
   - Add `VITE_API_BASE_URL="https://my-api.vercel.app"` to your env.
   - Update the frontend `fetch("/api/...")` calls to prefix with
     `import.meta.env.VITE_API_BASE_URL ?? ""`.
3. Run `npm run build` and push the `dist/` folder to the `gh-pages` branch.

**Option B — don't use GitHub Pages.** Cloudflare Pages, Vercel, and Netlify
have free tiers and support server routes natively.

---

## 5. Mobile APK (Capacitor)

The project already includes `capacitor.config.ts`. To build a standalone APK
that talks to your deployed backend (not Lovable):

1. Deploy the web app to Vercel/Netlify and note the URL.
2. Edit `capacitor.config.ts`:
   ```ts
   server: {
     url: "https://your-deployment.vercel.app",
     cleartext: false,
   },
   ```
3. Build and sync:
   ```bash
   npm run build
   npx cap add android        # first time only
   npx cap sync android
   npx cap open android       # opens Android Studio
   ```
4. In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

The mobile app loads the deployed web app, which calls `/api/ai-*` on the same
origin — so the AI works the same way it does in a browser.

---

## 6. Self-hosting (Node server)

```bash
npm install
npm run build
node .output/server/index.mjs   # or whatever path your build emits
```

Make sure all env vars from `.env.example` are exported in the shell.

---

## 7. Troubleshooting

- **`No AI provider configured`** — set one of `OPENAI_API_KEY`, `GEMINI_API_KEY`,
  `LOVABLE_API_KEY` on the **server** environment (not just `VITE_*`).
- **401 / 403 from AI provider** — wrong or expired API key.
- **429** — provider rate limit; the API surfaces a friendly message.
- **CORS errors** — only possible if you split the frontend and backend across
  different origins (e.g. GitHub Pages + Vercel backend). Add CORS headers to
  `src/routes/api/*.ts` handlers, or keep them on the same origin.
- **AI response disappears** — already handled: assistant messages are persisted
  by the client via `/api/ai-save-message` once streaming completes, so reloads
  show the full history.
