# Next.js + Supabase V1 Plan

**Goal:** Move the phone ledger from a Vite/Express local app to a deployable Next.js App Router app backed by authenticated Supabase services.

**Architecture:** Next.js 16 serves the UI and authenticated route handlers. Supabase Auth uses `@supabase/ssr`; every server data request validates the current user. Reads and deletes rely on Postgres RLS. The browser uploads compressed photos to a private Storage bucket through the publishable key, with Storage policies restricting objects to the signed-in user's folder. The server stores only private object paths and issues photos through an authenticated Next.js route. A server-only service key is used only for inserts after authentication and Zod validation; it is never included in browser code.

**Tasks:**

- [x] Inspect the existing Vite/Express app, preserve the catalog and ledger UI, and confirm current Next.js/Supabase package versions.
- [x] Replace Vite/Express entry points and scripts with Next.js App Router, auth/setup screens, and secure headers.
- [x] Add SSR/browser Supabase clients and token refresh proxy using current Next.js conventions.
- [x] Add authenticated transaction and private-photo route handlers with Zod/catalog validation.
- [x] Add a Supabase SQL migration with per-user RLS and private Storage policies.
- [x] Adapt image entry to direct private Storage uploads and persist paths in Supabase.
- [x] Document local env setup, Supabase SQL setup, and Vercel deployment; build the app without requiring live Supabase credentials.

**Security checks:** No secrets in browser code; no service-role key; authenticated user checked server-side on each API request; rows and objects scoped by `auth.uid()`; photo uploads constrained by type, size, generated path, and non-upsert behavior; API responses and private photos are non-cacheable.
