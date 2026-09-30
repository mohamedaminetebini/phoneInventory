# Phone Inventory

A private iPhone buy/sell ledger built with Next.js App Router and Supabase. It includes a searchable model picker, catalog-backed color choices, stock totals, transaction history, and private phone/ID photo attachments.

## Run locally

Use Node.js 20.9 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3002`. Without Supabase environment values, the app shows the setup screen. After adding the values below, it shows a sign-in screen. The app has no account creation flow; provision the single owner account in Supabase.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run [`supabase/migrations/20260930000000_phone_inventory.sql`](supabase/migrations/20260930000000_phone_inventory.sql). It creates the transaction table, ownership policies, private photo bucket, and user-scoped Storage policies.
3. In Supabase **Project Settings → API**, copy the Project URL and publishable key, plus the server-side service-role/secret key, into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   ```

4. In Supabase **Authentication → URL Configuration**, add `http://localhost:3002/auth/callback` to the allowed redirect URLs. For production, add `https://your-domain/auth/callback` and set the Site URL to your production domain.
5. In Supabase **Authentication → Users**, add the one owner account with a strong password.
6. In **Authentication → Settings**, disable **Allow new users to sign up** and **Allow anonymous sign-ins**. Remove any other test accounts so only the owner can use the app.
7. Start the app again and sign in with the owner account.

The publishable key is designed for browser use. The server-only service key is used only after the route verifies the signed-in user and validates the transaction. Authenticated clients have no direct database insert permission, so they cannot bypass model/color validation through Supabase's Data API. Never add the server key to a `NEXT_PUBLIC_` variable or import it into client code. Keep `.env.local` out of source control; `.env.*` is ignored except `.env.example`.

## Deploy to Vercel

Import the repository as a Next.js project and add these environment variables in Vercel for the environments you will use:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; do not prefix it with `NEXT_PUBLIC_`)
- `CRON_SECRET` (random secret used to authenticate Vercel's daily database activity check; keep it server-only)

Run a new deployment after adding them. The security policy allows connections only to the Supabase project URL configured at build time. Add your production callback URL in Supabase Auth before using an invite link.

Vercel uses the included `npm run build` and `npm start` scripts. Set the Supabase SQL migration up once per project before saving transactions.

The daily keep-alive Cron is scheduled for 04:00 UTC (around 05:00 in Tunisia). On Vercel Hobby it can run any time during the 04:00–04:59 UTC hour. Generate a secret with `openssl rand -hex 32`, then set that value as `CRON_SECRET` in Vercel's production environment before deploying. Vercel sends it as a bearer token to the protected `/api/cron/keep-alive` route. The route performs a read-only query that returns no transaction details. This can help a Supabase Free project register database activity, but Supabase does not guarantee that one daily request alone prevents inactivity pausing.

## Private data controls

- The dashboard and API require a signed-in Supabase user. Supabase Auth is configured for one account: new sign-ups and anonymous sign-ins are disabled, and only the owner account is kept in the project.
- The server verifies the user on every transaction and photo request.
- Postgres RLS limits reads and deletes to their owner; direct client inserts are revoked. Storage RLS limits uploads, reads, and deletes to the user's folder.
- The photo bucket is private. The browser uploads JPEGs directly with the publishable key; the server stores only generated object paths and streams images through an authenticated, non-cacheable route.
- Uploads are limited to JPEG images of 5 MB, use generated paths, and cannot overwrite existing objects.
- Transaction records and private image responses are marked `no-store`; standard security headers and a Content Security Policy are enabled.

Supabase Auth rate limits and email settings are managed in the Supabase project. The app intentionally exposes sign-in only; account provisioning stays in the Supabase Dashboard.

This Next.js version starts a new Supabase ledger. It does not import transactions from the earlier local prototype.
