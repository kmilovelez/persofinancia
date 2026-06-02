# Deployment Guide — PersoFinancIA

## Prerequisites

1. GitHub account
2. Vercel account (free tier)
3. Supabase project `hgvgjwvwiycuxcebqfvx` (already exists)
4. Google Cloud Console project with OAuth 2.0 credentials

## Step 1: Apply Database Migrations

In Supabase Dashboard → SQL Editor, run:

1. `persofinancia/supabase/migrations/20260601000001_initial_schema.sql`
2. After registering your user, run `20260601000002_migrate_bancolombia.sql`

## Step 2: Configure Supabase Edge Function Secrets

In Supabase Dashboard → Edge Functions → Secrets, add:

```
CLAUDE_API_KEY = sk-ant-...
```

## Step 3: Deploy Edge Functions

```bash
cd persofinancia
npx supabase login
npx supabase link --project-ref hgvgjwvwiycuxcebqfvx
npx supabase functions deploy classify-tx --no-verify-jwt
npx supabase functions deploy ingest-emails --no-verify-jwt
```

## Step 4: Configure Edge Function Cron (ingest-emails)

In Supabase Dashboard → Edge Functions → ingest-emails → Schedule:
- Cron: `0 12 * * *` (7:30am Colombia = 12:30pm UTC)

## Step 5: Deploy to Vercel

1. Push to GitHub: `git push origin main`
2. Go to vercel.com → New Project → Import from GitHub
3. Select the `persofinancia` subdirectory as the root
4. Add environment variables in Vercel Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL, e.g. https://persofinancia.vercel.app)
   - `SUPABASE_SERVICE_ROLE_KEY`

## Step 6: Configure Supabase Auth

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://persofinancia.vercel.app`
- Redirect URLs: `https://persofinancia.vercel.app/api/auth/callback`

In Supabase Dashboard → Authentication → Providers → Google:
- Enable Google provider
- Add Google OAuth Client ID and Secret
- Add redirect URI: `https://hgvgjwvwiycuxcebqfvx.supabase.co/auth/v1/callback`

## Step 7: Register and Migrate Data

1. Open your Vercel URL → Register with kmivelez@gmail.com
2. After registering, run migration script in Supabase SQL Editor
3. Go to Config → Bancos → Connect Gmail
4. Enable Bancolombia bank → Toggle to active
5. Click "Sincronizar ahora" to test ingestion
