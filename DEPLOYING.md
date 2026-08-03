# Deploying LumoroX Park to Vercel

The app is a TanStack Start (SSR) project. The build emits Vercel's native
Build Output API bundle at `.vercel/output`, so no adapter or framework preset
is needed.

## 1. Import the repository

Vercel → **Add New → Project → Import Git Repository**.

`vercel.json` in the repo already sets everything Vercel needs:

| Setting          | Value              |
| ---------------- | ------------------ |
| Framework preset | Other (`null`)     |
| Install command  | `npm install`      |
| Build command    | `npm run build`    |
| Output directory | `.vercel/output`   |
| Node version     | 22.x (from `engines`) |

Do not override these in the dashboard.

## 2. Add environment variables

Copy every key from `.env.example` into **Settings → Environment Variables**
for the **Production** (and **Preview**, if used) environment.

`VITE_*` variables are compiled into the browser bundle, so they must exist
**before** the first build. If you add them later, redeploy.

Minimum set for a fully working deployment:

- `VITE_SITE_URL` — your live URL, e.g. `https://lumoropark.vercel.app`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_RAZORPAY_KEY_ID` (an `rzp_live_...` key for production)
- `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `PAYMENTS_LIVE_WEBHOOK_SECRET`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`
- `LOVABLE_API_KEY`

Without `SUPABASE_SERVICE_ROLE_KEY`, payment settlement, expiry of stale
checkout holds and account deletion will fail. Without the Razorpay keys,
checkout cannot resolve prices.

## 3. Point the payment webhook at Vercel

After the first successful deploy, update the payment provider's webhook
destination to:

```
https://<your-vercel-domain>/api/public/payments/razorpay-webhook?env=live
```

(and the test destination to the same URL with `?env=sandbox`).

Subscribe these events: `transaction.completed`, `transaction.payment_failed`,
`adjustment.created`, `subscription.created`, `subscription.updated`,
`subscription.canceled`.

## 4. Allow the new domain in the backend

In the backend auth settings, add the Vercel domain to the allowed redirect
URLs / site URL, otherwise email confirmation, password reset and Google
sign-in will bounce back to the old domain.

## 5. Verify after deploy

1. `/` loads with the map placeholder, then the interactive map.
2. `/robots.txt` and `/sitemap.xml` show your Vercel domain.
3. Sign up, confirm email, sign in.
4. Create a listing, book it, pay with the test card `4242 4242 4242 4242`.
5. Check the booking flips to confirmed (this proves the webhook and the
   service-role key are wired correctly).
6. `/profile` → billing history shows the payment.

## Local production check

```bash
npm run build      # produces .vercel/output outside the Lovable sandbox
npx vite preview
```

Inside the Lovable sandbox the build always targets Cloudflare instead; that is
expected and does not affect Vercel.

## Google sign-in on Vercel

The Lovable OAuth broker only works on `*.lovable.app` domains. On Vercel the
app falls back to the backend's own Google OAuth endpoint
(`src/lib/google-signin.ts`), so add your Vercel URL (e.g.
`https://your-app.vercel.app/auth`) to the allowed redirect URLs in the
Cloud → Users → Authentication settings before going live.
Email/password sign-in only needs `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` present **at build time** in Vercel.

---

## Using your own Supabase project

The app talks to Supabase through standard environment variables, so it can run
against any Supabase project — Lovable-managed or your own.

1. Create a project at supabase.com.
2. Open **SQL Editor** and run `supabase/schema.sql` once. That file contains
   every table, index, constraint, function, trigger, RLS policy and grant this
   app needs. Regenerate it any time with `bash scripts/export-schema.sh`.
3. **Authentication → Providers**: enable Email, and enable Google if you want
   social sign-in (paste your Google OAuth client ID/secret).
4. **Authentication → URL Configuration**: set the Site URL to your deployed
   domain and add these redirect URLs:
   - `https://your-domain/auth`
   - `https://your-domain/reset-password`
5. **Project Settings → API**: copy the project URL, the publishable key and the
   service-role key into your host's environment variables (see `.env.example`).

Off Lovable hosting, Google sign-in automatically uses Supabase's own OAuth
flow instead of the Lovable broker — no code change required.

### Project `xlmmmbztwreeqkbmwdan` (ap-south-1)

Set exactly these in Vercel → Settings → Environment Variables, then redeploy
(the `VITE_*` ones are baked in at build time):

```
VITE_SUPABASE_URL=https://xlmmmbztwreeqkbmwdan.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_pWXbMiHdxsWjFo1czaT1lA_FUooRSmv
VITE_SUPABASE_PROJECT_ID=xlmmmbztwreeqkbmwdan
SUPABASE_URL=https://xlmmmbztwreeqkbmwdan.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_pWXbMiHdxsWjFo1czaT1lA_FUooRSmv
SUPABASE_PROJECT_ID=xlmmmbztwreeqkbmwdan
SUPABASE_SERVICE_ROLE_KEY=<your sb_secret_... key>
```

Name mapping from the Supabase "Connect" panel (that panel assumes Next.js;
this app is TanStack Start):

| Supabase panel | This app |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `VITE_SUPABASE_URL` (+ `SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` (+ `SUPABASE_PUBLISHABLE_KEY`) |
| `SUPABASE_SECRET_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_JWKS_URL` | not needed — tokens are verified via the Supabase client |

Before the first deploy against this project:

1. SQL Editor → run `supabase/schema.sql` once (creates every table, function,
   trigger, RLS policy and grant).
2. Authentication → Providers → enable Email, and Google if wanted.
3. Authentication → URL Configuration → Site URL = your Vercel domain, with
   `https://<domain>/auth`, `https://<domain>/auth/callback` and
   `https://<domain>/reset-password` as redirect URLs.
4. Rotate the secret key if it has ever been pasted into a chat or shared doc.

The Lovable editor preview keeps using its own managed backend; these values
only take effect on Vercel (or any host you set them on).


## Deploying

All three platforms build with `npm run build` and serve `.output`.

| Platform | Config in repo | Notes |
| --- | --- | --- |
| Vercel | `vercel.json` | Output directory `.vercel/output`. |
| Netlify | `netlify.toml` | Sets `NITRO_PRESET=netlify`; publishes `dist/client`. |
| Render | `render.yaml` | Sets `NITRO_PRESET=node-server`; starts `node .output/server/index.mjs`. |

Set every variable from `.env.example` **before** the first build — anything
prefixed with `VITE_` is baked into the browser bundle at build time.

### Payments without Lovable hosting

The server calls the Razorpay API directly using `RAZORPAY_KEY_SECRET`.
Point your Razorpay webhook at
`https://your-domain/api/public/payments/razorpay-webhook?env=live` (and the sandbox one
at `...?env=sandbox`) and store the signing secrets in
`PAYMENTS_LIVE_WEBHOOK_SECRET` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET`.

## Currencies

Drivers can pay in **US dollars or Indian rupees**, and can pay any amount:

- Prices are authored in USD; the footer switcher (and the one next to every
  Pay button) converts the display and the charge.
- The conversion rate lives in `src/lib/currency.ts` (`USD_TO_INR`) so a quote
  can never drift from the amount charged.
- Booking payments and the **Add parking credit** page (`/topup`) both create a
  single custom-amount Razorpay order server-side, so there is no upper
  limit tied to catalog pricing. Booking amounts are always recalculated on the
  server — the browser never dictates what is charged.
